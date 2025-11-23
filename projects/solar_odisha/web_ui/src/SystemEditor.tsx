import React from 'react';
import { SystemConfig } from './SimulationEngine';
import './SystemEditor.css';

interface Props {
    config: SystemConfig;
    onConfigChange: (newConfig: SystemConfig) => void;
}

const SystemEditor: React.FC<Props> = ({ config, onConfigChange }) => {
    const handleChange = (field: keyof SystemConfig, value: number) => {
        onConfigChange({
            ...config,
            [field]: value
        });
    };

    return (
        <div className="system-editor">
            <h3>System Configuration</h3>

            <div className="editor-group">
                <h4>Solar Panels</h4>
                <div className="input-row">
                    <label>Count:</label>
                    <input
                        type="number"
                        value={config.numPanels}
                        onChange={(e) => handleChange('numPanels', Number(e.target.value))}
                        min="1"
                    />
                </div>
                <div className="input-row">
                    <label>Watts (per panel):</label>
                    <input
                        type="number"
                        value={config.panelWattage}
                        onChange={(e) => handleChange('panelWattage', Number(e.target.value))}
                        step="10"
                    />
                </div>
                <div className="input-row">
                    <label>Voltage (V):</label>
                    <input
                        type="number"
                        value={config.panelVoltage}
                        onChange={(e) => handleChange('panelVoltage', Number(e.target.value))}
                    />
                </div>
            </div>

            <div className="editor-group">
                <h4>DC Wiring (Panel to Controller)</h4>
                <div className="input-row">
                    <label>Gauge (mm²):</label>
                    <select
                        value={config.wireGaugeMm2}
                        onChange={(e) => handleChange('wireGaugeMm2', Number(e.target.value))}
                    >
                        <option value="1.5">1.5 mm²</option>
                        <option value="2.5">2.5 mm²</option>
                        <option value="4">4 mm²</option>
                        <option value="6">6 mm²</option>
                        <option value="10">10 mm²</option>
                        <option value="16">16 mm²</option>
                        <option value="25">25 mm²</option>
                    </select>
                </div>
                <div className="input-row">
                    <label>Distance (ft):</label>
                    <input
                        type="number"
                        value={config.wireLengthFt}
                        onChange={(e) => handleChange('wireLengthFt', Number(e.target.value))}
                    />
                </div>
            </div>

            <div className="editor-group">
                <h4>Battery Bank</h4>
                <div className="input-row">
                    <label>Capacity (Ah):</label>
                    <input
                        type="number"
                        value={config.batteryCapacityAh}
                        onChange={(e) => handleChange('batteryCapacityAh', Number(e.target.value))}
                    />
                </div>
                <div className="input-row">
                    <label>System Voltage (V):</label>
                    <input
                        type="number"
                        value={config.batteryVoltage}
                        onChange={(e) => handleChange('batteryVoltage', Number(e.target.value))}
                    />
                </div>
                <div className="input-row">
                    <label>C-Rating (e.g. 10):</label>
                    <input
                        type="number"
                        value={config.batteryCRating}
                        onChange={(e) => handleChange('batteryCRating', Number(e.target.value))}
                    />
                </div>
            </div>
        </div>
    );
};

export default SystemEditor;
