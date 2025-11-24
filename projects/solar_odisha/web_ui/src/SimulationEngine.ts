export interface SystemConfig {
    numPanels: number;
    panelWattage: number;
    panelVoltage: number;
    wireGaugeMm2: number;
    wireLengthFt: number;
    batteryCapacityAh: number;
    batteryVoltage: number;
    batteryCRating: number; // e.g., 10 for C10, 20 for C20
    inverterEfficiency: number;
    controllerEfficiency: number;
}

export interface WireAnalysis {
    current: number;
    resistance: number;
    powerLoss: number;
    voltageDrop: number;
    voltageDropPercent: number;
    isSafe: boolean;
    recommendedMm2: number;
    message: string;
}

export interface WireSegmentStats {
    current: number;
    powerLoss: number;
    voltageDrop: number;
    isSafe: boolean;
}

export interface SystemState {
    sunIntensity: number;
    generation: number;
    panelVoltage: number;
    wireAnalysis: WireAnalysis; // Keeping global analysis for now, but adding detailed stats
    wireStats: {
        solarToController: WireSegmentStats;
        controllerToBattery: WireSegmentStats;
        batteryToInverter: WireSegmentStats;
        inverterToLoad: WireSegmentStats;
    };
    powerAtController: number;
    powerToBattery: number;
    batteryLevel: number;
    batteryPercent: number;
    acLoad: number;
    inverterInput: number;
    netBatteryFlow: number;
    gridActive: boolean;
    gridExport: number;
    gridImport: number;
    wastedPower: number;
    battToInvPower: number;
}

export const DEFAULT_CONFIG: SystemConfig = {
    numPanels: 2,
    panelWattage: 250,
    panelVoltage: 25,
    wireGaugeMm2: 10,
    wireLengthFt: 20,
    batteryCapacityAh: 300,
    batteryVoltage: 24,
    batteryCRating: 20, // C20 for slower charging
    inverterEfficiency: 0.8, // Updated to 80%
    controllerEfficiency: 0.9, // Updated to 90%
};

export function calculateSystemState(
    sunIntensity: number,
    acLoad: number,
    currentBatteryLevel: number,
    config: SystemConfig,
    timeOfDay: number,
    systemMode: 'OFF_GRID' | 'ON_GRID' | 'HYBRID' = 'HYBRID'
): SystemState {
    // 1. Sun Window
    let effectiveIntensity = sunIntensity;
    if (timeOfDay < 9 || timeOfDay > 16) {
        effectiveIntensity = 0;
    }

    // 2. Generation
    const solarInput = config.numPanels * config.panelWattage * effectiveIntensity;

    // Helper for wire calc
    const calcWire = (power: number, voltage: number, lengthFt: number, gauge: number): WireSegmentStats => {
        if (power <= 0 || voltage <= 0) return { current: 0, powerLoss: 0, voltageDrop: 0, isSafe: true };
        const current = power / voltage;
        const lengthM = lengthFt * 0.3048;
        const resistance = (0.0172 * lengthM * 2) / gauge;
        const powerLoss = Math.pow(current, 2) * resistance;
        const voltageDrop = current * resistance;
        const isSafe = current <= (gauge * 5);
        return { current, powerLoss, voltageDrop, isSafe };
    };

    // Solar -> Controller
    const solarStats = calcWire(solarInput, config.panelVoltage, config.wireLengthFt, config.wireGaugeMm2);
    const powerAtController = Math.max(0, solarInput - solarStats.powerLoss);

    // 3. Battery Charging Limits
    const maxChargeCurrent = config.batteryCapacityAh / config.batteryCRating;
    const maxChargePower = maxChargeCurrent * config.batteryVoltage;

    // 4. Battery State (Moved up for logic use)
    const maxWh = config.batteryCapacityAh * config.batteryVoltage;
    const batteryPercent = (currentBatteryLevel / maxWh) * 100;
    const isBatteryFull = batteryPercent >= 100;

    // 5. Inverter & Load (Determine Demand FIRST)
    const inverterInput = acLoad / config.inverterEfficiency;

    let inverterDrawFromBattery = 0;
    let gridActive = false;
    let gridExport = 0;
    let gridImport = 0;
    let gridChargingPower = 0;

    if (systemMode === 'OFF_GRID') {
        gridActive = false;
        inverterDrawFromBattery = inverterInput;
    } else if (systemMode === 'ON_GRID') {
        gridActive = true;
        const solarPowerAC = solarInput * config.inverterEfficiency;
        if (solarPowerAC >= acLoad) {
            gridExport = solarPowerAC - acLoad;
            gridImport = 0;
        } else {
            gridExport = 0;
            gridImport = acLoad - solarPowerAC;
        }
        inverterDrawFromBattery = 0;
    } else { // HYBRID
        // Hybrid Logic Refined:
        // 1. Prioritize Solar for Load.
        // 2. If Solar > Load, excess to Battery.
        // 3. If Solar < Load, use Battery (if > 30%).
        // 4. Only use Grid if Battery < 30% AND Solar insufficient.

        const GRID_THRESHOLD = 30; // Lowered from 70% to use battery more
        const GRID_CHARGE_THRESHOLD = 20;
        const isLowSolar = effectiveIntensity < 0.1;

        // Check if Solar + Battery can meet load
        // Solar available at DC bus (approx)
        const solarAvailableForLoad = powerAtController * config.controllerEfficiency;
        const batteryCanSupport = batteryPercent > GRID_THRESHOLD;

        if (solarAvailableForLoad >= inverterInput) {
            // Solar covers load
            gridActive = true; // Grid is connected but idle
            inverterDrawFromBattery = inverterInput; // Will be covered by Solar via DC bus
        } else if (batteryCanSupport) {
            // Solar + Battery covers load
            gridActive = true; // Grid is connected but idle
            inverterDrawFromBattery = inverterInput;
        } else {
            // Need Grid
            gridActive = true;
            gridImport = acLoad;
            inverterDrawFromBattery = 0;

            // Emergency Charge from Grid
            if (batteryPercent < GRID_CHARGE_THRESHOLD && isLowSolar) {
                const chargeNeeded = maxChargePower;
                gridChargingPower = chargeNeeded / config.inverterEfficiency;
                gridImport += gridChargingPower;
            }
        }
    }

    // 6. Controller Output (Solar -> DC Bus)
    // Controller can supply: Battery Charge + Inverter Load
    // It is limited by: Solar Input AND (Max Charge + Inverter Demand)
    let powerAvailableForCharging = powerAtController * config.controllerEfficiency;
    let totalDemand = maxChargePower + inverterDrawFromBattery;

    // If On-Grid, no battery charging
    if (systemMode === 'ON_GRID') {
        totalDemand = 0;
    }

    let powerToBattery = 0; // This is actually "Controller Output"
    let wastedPower = 0;

    if (systemMode === 'ON_GRID') {
        powerToBattery = 0;
    } else {
        // Allow controller to output enough for Load + Max Charge
        if (powerAvailableForCharging > totalDemand) {
            if (systemMode === 'HYBRID') {
                // EXPORT LOGIC:
                // If Hybrid, excess power goes to Grid instead of being wasted.
                const excessDC = powerAvailableForCharging - totalDemand;
                powerToBattery = powerAvailableForCharging; // Output full solar
                wastedPower = 0;

                // Route excess to Inverter for Export
                inverterDrawFromBattery += excessDC;
                gridExport = excessDC * config.inverterEfficiency;
                gridActive = true;
            } else {
                // Off-Grid: Waste the excess
                powerToBattery = totalDemand;
                wastedPower = powerAvailableForCharging - totalDemand;
            }
        } else {
            powerToBattery = powerAvailableForCharging;
            wastedPower = 0;
        }
    }

    // Controller -> Battery Stats (Wire 1)
    const controllerToBattStats = calcWire(powerToBattery, config.batteryVoltage, 5, config.wireGaugeMm2);

    // 7. Net Battery Flow
    let netBatteryFlow = 0;
    let effectiveControllerOutput = powerToBattery;
    let gridChargeDC = 0;

    if (systemMode === 'ON_GRID') {
        netBatteryFlow = 0;
    } else {
        // Refined Net Flow:
        // Inflow = powerToBattery (Controller Output)
        // Outflow = inverterDrawFromBattery (Load + Export)
        // Grid Charge = gridChargingPower * eff (DC)

        gridChargeDC = gridChargingPower * config.inverterEfficiency;

        // If Battery is Full, Controller should reduce output to match Load + Export
        // Note: If Hybrid Exporting, we already set powerToBattery to full.
        // If Off-Grid, we capped it at totalDemand.

        netBatteryFlow = (effectiveControllerOutput + gridChargeDC) - inverterDrawFromBattery;

        // Safety Clamp: If net flow > maxChargePower, it means we are pushing too much into battery?
        // In Hybrid Export, (Load + Charge + Export) - (Load + Export) = Charge.
        // So it should be exactly maxChargePower.

        // However, if Battery is FULL (100%), we shouldn't be charging.
        if (isBatteryFull && netBatteryFlow > 0) {
            // We are pushing current into a full battery.
            // In reality, the controller voltage rises and current drops.
            // We should reduce effectiveControllerOutput to stop charging.
            const excessCharge = netBatteryFlow;
            // If Hybrid, this excess charge could ALSO be exported!
            if (systemMode === 'HYBRID') {
                // Redirect this last bit of "Charge" to Export
                inverterDrawFromBattery += excessCharge;
                gridExport += (excessCharge * config.inverterEfficiency);
                netBatteryFlow = 0;
            } else {
                // Off-Grid: Waste it
                effectiveControllerOutput -= excessCharge;
                wastedPower += excessCharge;
                netBatteryFlow = 0;
            }
        }
    }

    // NET GRID FLOW CORRECTION
    // It is physically impossible to Import and Export simultaneously on a single phase.
    // We must net them out.
    if (gridImport > 0 && gridExport > 0) {
        if (gridImport >= gridExport) {
            gridImport -= gridExport;
            gridExport = 0;
        } else {
            gridExport -= gridImport;
            gridImport = 0;
        }
    }

    // Battery -> Inverter Stats
    const battToInvPower = gridChargingPower > 0 ? gridChargingPower : inverterDrawFromBattery;
    const battToInvStats = calcWire(battToInvPower, config.batteryVoltage, 5, config.wireGaugeMm2);

    // Inverter -> Load Stats
    const invToLoadStats = calcWire(acLoad, 230, 20, 2.5);

    // Legacy WireAnalysis
    const wireAnalysis: WireAnalysis = {
        current: solarStats.current,
        resistance: 0,
        powerLoss: solarStats.powerLoss,
        voltageDrop: solarStats.voltageDrop,
        voltageDropPercent: (solarStats.voltageDrop / config.panelVoltage) * 100,
        isSafe: solarStats.isSafe,
        recommendedMm2: 0,
        message: solarStats.isSafe ? "OK" : "WARNING: Wire overheating!"
    };

    return {
        sunIntensity: effectiveIntensity,
        generation: solarInput,
        panelVoltage: config.panelVoltage,
        wireAnalysis,
        wireStats: {
            solarToController: solarStats,
            controllerToBattery: controllerToBattStats,
            batteryToInverter: battToInvStats,
            inverterToLoad: invToLoadStats
        },
        powerAtController,
        powerToBattery: effectiveControllerOutput, // Use effective output (after full-battery reduction)
        batteryLevel: currentBatteryLevel,
        batteryPercent,
        acLoad,
        inverterInput,
        netBatteryFlow,
        gridActive,
        gridExport,
        gridImport,
        wastedPower,
        battToInvPower
    };
}
