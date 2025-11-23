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

    return (
        <div className="schematic-wrapper">
            <div className="schematic-container">

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

                {/* Wire: Controller -> Battery (Only if NOT On-Grid) */}
                {systemMode !== 'ON_GRID' && (
                    <div className="wire-segment horizontal" style={{ gridColumn: 4, gridRow: 1 }}>
                        <div className="wire-info">
                            <span className="wire-type dc">DC</span>
                            <span className="wire-power">{fmt(Math.abs(state.netBatteryFlow))} W</span>
                            <span className="wire-current">{fmtDec(state.wireStats.controllerToBattery.current)} A</span>
                            <span className="wire-loss">Loss: {fmtDec(state.wireStats.controllerToBattery.powerLoss)} W</span>
                        </div>
                        <div className="wire-arrow">{state.netBatteryFlow > 0 ? '→' : '←'}</div>
                    </div>
                )}

                {/* Battery (Only if NOT On-Grid) */}
                {systemMode !== 'ON_GRID' && (
                    <div className="component-box battery-box" style={{ gridColumn: 5, gridRow: 1 }}>
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

                {/* --- ROW 2 (Vertical Connections) --- */}

                {/* Wire: Controller -> Inverter (DC Bus) OR Solar -> Inverter (On-Grid) */}
                <div className="wire-segment vertical" style={{ gridColumn: 3, gridRow: 2 }}>
                    <div className="wire-info">
                        <span className="wire-type dc">{systemMode === 'ON_GRID' ? 'HV DC' : 'DC Bus'}</span>
                        <span className="wire-power">{fmt(state.inverterInput)} W</span>
                    </div>
                    <div className="wire-arrow">↓</div>
                </div>

                {/* --- ROW 3 --- */}

                {/* Inverter */}
                <div className="component-box inverter-box" style={{ gridColumn: 3, gridRow: 3 }}>
                    <div className="icon">🔌</div>
                    <div className="title">Inverter</div>
                    <div className="details">Out: {fmt(state.acLoad)} W<br />Eff: {config.inverterEfficiency * 100}%</div>
                </div>

                {/* Wire: Inverter -> Load */}
                <div className="wire-segment horizontal" style={{ gridColumn: 4, gridRow: 3 }}>
                    <div className="wire-info">
                        <span className="wire-type ac">AC</span>
                        <span className="wire-power">{fmt(state.acLoad)} W</span>
                        <span className="wire-current">{fmtDec(state.wireStats.inverterToLoad.current)} A</span>
                        <span className="wire-loss">Loss: {fmtDec(state.wireStats.inverterToLoad.powerLoss)} W</span>
                    </div>
                    <div className="wire-arrow">→</div>
                </div>

                {/* Load */}
                <div className="component-box load-box" style={{ gridColumn: 5, gridRow: 3 }}>
                    <div className="icon">🏠</div>
                    <div className="title">Load</div>
                    <div className="details">{fmt(state.acLoad)} W</div>
                </div>

                {/* --- ROW 4 (Vertical Connections) --- */}

                {/* Wire: Inverter <-> Grid */}
                {systemMode !== 'OFF_GRID' && (
                    <div className="wire-segment vertical" style={{ gridColumn: 3, gridRow: 4 }}>
                        <div className="wire-info">
                            <span className="wire-type ac">AC Grid</span>
                            {state.gridImport > 0 && <span className="wire-power">In: {fmt(state.gridImport)} W</span>}
                            {state.gridExport > 0 && <span className="wire-power">Out: {fmt(state.gridExport)} W</span>}
                        </div>
                        <div className="wire-arrow">{state.gridImport > 0 ? '↑' : state.gridExport > 0 ? '↓' : '↕'}</div>
                    </div>
                )}

                {/* --- ROW 5 --- */}

                {/* Grid */}
                {systemMode !== 'OFF_GRID' && (
                    <div className={`component-box grid-box ${state.gridActive ? 'active' : ''}`} style={{ gridColumn: 3, gridRow: 5 }}>
                        <div className="icon">🏢</div>
                        <div className="title">Grid</div>
                        <div className="details">{state.gridActive ? 'ON' : 'OFF'}</div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default SystemDiagram;
