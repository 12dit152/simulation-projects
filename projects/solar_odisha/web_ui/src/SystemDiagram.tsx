import React from 'react';
import './SystemDiagram.css';
import { SystemState, SystemConfig } from './SimulationEngine';

interface SystemDiagramProps {
    state: SystemState;
    config: SystemConfig;
    batteryLevel: number;
    systemMode: 'OFF_GRID' | 'ON_GRID' | 'HYBRID';
}

const SystemDiagram: React.FC<SystemDiagramProps> = ({ state, config, batteryLevel, systemMode }) => {
    const fmt = (n: number) => Math.round(n).toLocaleString();
    const fmtDec = (n: number) => n.toFixed(1);

    // On-Grid: Solar moves to center (Col 3) to align with Inverter
    const solarCol = systemMode === 'ON_GRID' ? 3 : 1;
    const containerClass = systemMode === 'ON_GRID' ? 'schematic-container on-grid' : 'schematic-container';

    return (
        <div className="schematic-wrapper">
            <div className={containerClass}>

                {/* --- ROW 1 --- */}

                {/* Solar Panel */}
                <div className="component-box panel-box" style={{ gridColumn: solarCol, gridRow: 1 }}>
                    <div className="icon">☀️</div>
                    <div className="title">Solar Array</div>
                    <div className="details">{fmt(state.generation)} W<br />{state.panelVoltage} V</div>
                </div>

                {/* Wire: Solar -> Controller (Only if NOT On-Grid) */}
                {systemMode !== 'ON_GRID' && (
                    <div className="wire-segment horizontal" style={{ gridColumn: 2, gridRow: 1 }}>
                        <div className="wire-info">
                            <span className="wire-type dc">DC</span>
                            <span className="wire-power">{fmt(state.generation)} W</span>
                            <span className="wire-current">{fmtDec(state.wireStats.solarToController.current)} A</span>
                            <span className="wire-loss">Loss: {fmtDec(state.wireStats.solarToController.powerLoss)} W</span>
                        </div>
                        <div className="wire-arrow">→</div>
                    </div>
                )}

                {/* Controller (Only if NOT On-Grid) */}
                {systemMode !== 'ON_GRID' && (
                    <div className="component-box controller-box" style={{ gridColumn: 3, gridRow: 1 }}>
                        <div className="icon">⚡</div>
                        <div className="title">Controller</div>
                        <div className="details">Eff: {config.controllerEfficiency * 100}%</div>
                    </div>
                )}

                {/* --- ROW 2 (Vertical Connection) --- */}

                {/* Wire: Controller -> Battery (Only if NOT On-Grid) */}
                {systemMode !== 'ON_GRID' && (
                    <div className="wire-segment vertical" style={{ gridColumn: 3, gridRow: 2 }}>
                        <div className="wire-info">
                            <span className="wire-type dc">DC</span>
                            {/* FIXED: Show only the power flowing INTO the battery from Controller */}
                            <span className="wire-power">{fmt(state.powerToBattery)} W</span>
                            <span className="wire-current">{fmtDec(state.wireStats.controllerToBattery.current)} A</span>
                            <span className="wire-loss">Loss: {fmtDec(state.wireStats.controllerToBattery.powerLoss)} W</span>
                        </div>
                        {/* FIXED: Arrow always points DOWN (Charge) or is hidden if 0. Controller never discharges. */}
                        <div className="wire-arrow">{state.powerToBattery > 0 ? '↓' : ''}</div>
                    </div>
                )}

                {/* --- ROW 3 --- */}

                {/* Battery (Only if NOT On-Grid) */}
                {systemMode !== 'ON_GRID' && (
                    <div className="component-box battery-box" style={{ gridColumn: 3, gridRow: 3 }}>
                        <div className="icon">🔋</div>
                        <div className="title">Battery</div>
                        <div className="details">
                            {Math.round(state.batteryPercent)}%
                            <div className="battery-bar">
                                <div className="battery-fill" style={{ width: `${Math.min(100, state.batteryPercent)}%` }}></div>
                            </div>
                            {fmt(batteryLevel)} Wh
                        </div>
                    </div>
                )}

                {/* --- ROW 4 (Vertical Connection) --- */}

                {/* Wire: Battery -> Inverter (DC Bus) */}
                <div className="wire-segment vertical" style={{ gridColumn: 3, gridRow: systemMode === 'ON_GRID' ? 2 : 4 }}>
                    <div className="wire-info">
                        <span className="wire-type dc">{systemMode === 'ON_GRID' ? 'HV DC' : 'DC Bus'}</span>
                        {/* FIXED: On-Grid = Solar Generation, Off-Grid/Hybrid = Battery Flow */}
                        <span className="wire-power">{fmt(systemMode === 'ON_GRID' ? state.generation : state.battToInvPower)} W</span>
                    </div>
                    {/* Arrow Logic: Down if Discharging (net < 0), Up if Charging from Grid (net > 0 and Night) */}
                    <div className="wire-arrow">
                        {systemMode === 'ON_GRID' ? '↓' : (state.netBatteryFlow < 0 ? '↓' : (state.gridImport > state.acLoad ? '↑' : '↓'))}
                    </div>
                </div>

                {/* --- ROW 5 --- */}

                {/* Inverter */}
                <div className="component-box inverter-box" style={{ gridColumn: 3, gridRow: systemMode === 'ON_GRID' ? 3 : 5 }}>
                    <div className="icon">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#bdc3c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="2" stroke="#9b59b6" />
                            <path d="M7 8h10" stroke="#f39c12" />
                            <path d="M7 16c0-3 2.5-5 5-5s5 2 5 5" stroke="#00bcd4" />
                        </svg>
                    </div>
                    <div className="title">Inverter</div>
                    <div className="details">Out: {fmt(state.acLoad)} W<br />Eff: {config.inverterEfficiency * 100}%</div>
                </div>

                {/* Wire: Inverter -> Load */}
                <div className="wire-segment horizontal" style={{ gridColumn: 4, gridRow: systemMode === 'ON_GRID' ? 3 : 5 }}>
                    <div className="wire-info">
                        <span className="wire-type ac">AC</span>
                        <span className="wire-power">{fmt(state.acLoad)} W</span>
                        <span className="wire-current">{fmtDec(state.wireStats.inverterToLoad.current)} A</span>
                        <span className="wire-loss">Loss: {fmtDec(state.wireStats.inverterToLoad.powerLoss)} W</span>
                    </div>
                    <div className="wire-arrow">→</div>
                </div>

                {/* Load */}
                <div className="component-box load-box" style={{ gridColumn: 5, gridRow: systemMode === 'ON_GRID' ? 3 : 5 }}>
                    <div className="icon">🏠</div>
                    <div className="title">Load</div>
                    <div className="details">{fmt(state.acLoad)} W</div>
                </div>

                {/* --- ROW 6 (Vertical Connection) --- */}

                {/* Wire: Inverter <-> Grid */}
                {systemMode !== 'OFF_GRID' && (
                    <div className="wire-segment vertical" style={{ gridColumn: 3, gridRow: systemMode === 'ON_GRID' ? 4 : 6 }}>
                        <div className="wire-info">
                            <span className="wire-type ac">AC Grid</span>
                            {state.gridImport > 0 && <span className="wire-power">In: {fmt(state.gridImport)} W</span>}
                            {state.gridExport > 0 && <span className="wire-power">Out: {fmt(state.gridExport)} W</span>}
                            {state.gridImport === 0 && state.gridExport === 0 && <span className="wire-power" style={{ opacity: 0.7 }}>Standby (0 W)</span>}
                        </div>
                        <div className="wire-arrow">{state.gridImport > 0 ? '↑' : state.gridExport > 0 ? '↓' : ''}</div>
                    </div>
                )}

                {/* --- ROW 7 --- */}

                {/* Grid */}
                {systemMode !== 'OFF_GRID' && (
                    <div className={`component-box grid-box ${state.gridActive ? 'active' : ''}`} style={{ gridColumn: 3, gridRow: systemMode === 'ON_GRID' ? 5 : 7 }}>
                        <div className="icon">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#7f8c8d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2L12 22" />
                                <path d="M5 10H19" />
                                <path d="M8 6H16" />
                                <path d="M2 14H22" />
                                <path d="M12 2L5 22" />
                                <path d="M12 2L19 22" />
                            </svg>
                        </div>
                        <div className="title">Grid</div>
                        <div className="details">{state.gridActive ? 'ON' : 'OFF'}</div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default SystemDiagram;
