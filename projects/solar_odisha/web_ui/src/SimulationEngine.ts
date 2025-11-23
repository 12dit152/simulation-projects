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

    // 3. Battery Charging
    const maxChargeCurrent = config.batteryCapacityAh / config.batteryCRating;
    const maxChargePower = maxChargeCurrent * config.batteryVoltage;

    let powerAvailableForCharging = powerAtController * config.controllerEfficiency;
    let powerToBattery = 0;
    let wastedPower = 0;

    if (systemMode === 'ON_GRID') {
        powerToBattery = 0;
        wastedPower = 0;
    } else {
        if (powerAvailableForCharging > maxChargePower) {
            powerToBattery = maxChargePower;
            wastedPower = powerAvailableForCharging - maxChargePower;
        } else {
            powerToBattery = powerAvailableForCharging;
            wastedPower = 0;
        }
    }

    // Controller -> Battery Stats
    // Current is based on power flowing INTO battery
    const controllerToBattStats = calcWire(powerToBattery, config.batteryVoltage, 5, config.wireGaugeMm2); // Assume 5ft

    // 4. Battery State
    const maxWh = config.batteryCapacityAh * config.batteryVoltage;
    const batteryPercent = (currentBatteryLevel / maxWh) * 100;
    const isBatteryFull = batteryPercent >= 100;

    // 5. Inverter & Load
    const inverterInput = acLoad / config.inverterEfficiency;

    let inverterDrawFromBattery = 0;
    let gridActive = false;
    let gridExport = 0;
    let gridImport = 0;

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
        if (batteryPercent < 70) {
            gridActive = true;
        } else {
            gridActive = false;
        }

        if (gridActive) {
            inverterDrawFromBattery = 0;
            gridImport = acLoad;
        } else {
            inverterDrawFromBattery = inverterInput;
            gridImport = 0;
        }
    }

    // Battery -> Inverter Stats
    const battToInvStats = calcWire(inverterDrawFromBattery, config.batteryVoltage, 5, config.wireGaugeMm2); // Assume 5ft

    // Inverter -> Load Stats (AC, 230V assumed)
    const invToLoadStats = calcWire(acLoad, 230, 20, 2.5); // Assume 20ft, 2.5mm2 standard AC wire

    // 6. Net Battery Flow
    let netBatteryFlow = 0;
    if (systemMode === 'ON_GRID') {
        netBatteryFlow = 0;
    } else {
        const actualCharge = isBatteryFull ? 0 : powerToBattery;
        netBatteryFlow = actualCharge - inverterDrawFromBattery;
    }

    // Legacy WireAnalysis (keeping for backward compatibility with existing UI parts if any)
    const wireAnalysis: WireAnalysis = {
        current: solarStats.current,
        resistance: 0, // Simplified
        powerLoss: solarStats.powerLoss,
        voltageDrop: solarStats.voltageDrop,
        voltageDropPercent: (solarStats.voltageDrop / config.panelVoltage) * 100,
        isSafe: solarStats.isSafe,
        recommendedMm2: 0, // Simplified
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
        powerToBattery,
        batteryLevel: currentBatteryLevel,
        batteryPercent,
        acLoad,
        inverterInput,
        netBatteryFlow,
        gridActive,
        gridExport,
        gridImport,
        wastedPower
    };
}
