import React, { useState } from 'react';
import './SizingCalculator.css';

interface Appliance {
    id: number;
    name: string;
    watts: number;
    hours: number;
}

const SizingCalculator: React.FC = () => {
    const [appliances, setAppliances] = useState<Appliance[]>([
        { id: 1, name: 'Ceiling Fan', watts: 75, hours: 8 },
        { id: 2, name: 'LED Bulb', watts: 10, hours: 6 },
    ]);
    const [newAppliance, setNewAppliance] = useState({ name: '', watts: 0, hours: 0 });

    const addAppliance = () => {
        if (newAppliance.name && newAppliance.watts > 0) {
            setAppliances([...appliances, { ...newAppliance, id: Date.now() }]);
            setNewAppliance({ name: '', watts: 0, hours: 0 });
        }
    };

    const removeAppliance = (id: number) => {
        setAppliances(appliances.filter(a => a.id !== id));
    };

    // Calculations
    const totalWatts = appliances.reduce((sum, a) => sum + a.watts, 0);
    const totalWhPerDay = appliances.reduce((sum, a) => sum + (a.watts * a.hours), 0);

    // Recommendations
    // 1. Inverter: Should handle Peak Load + 25% safety
    const recInverterSize = Math.ceil(totalWatts * 1.25);

    // 2. Battery: Total Wh / Voltage (24V) * Days of Autonomy (1) / Depth of Discharge (0.5 for Lead Acid)
    // Let's assume 1 day autonomy and 50% DoD.
    const recBatteryAh24V = Math.ceil(totalWhPerDay / 24 / 0.5);

    // 3. Panels: Total Wh / Sun Hours (5 avg) / Efficiency (0.7 system losses)
    const recPanelWatts = Math.ceil(totalWhPerDay / 5 / 0.7);
    const recPanelCount = Math.ceil(recPanelWatts / 250); // Assuming 250W panels

    // Calculate 12V Battery Count (assuming 150Ah 12V batteries)
    // Total Wh needed = recBatteryAh24V * 24V
    // Each 12V battery = 150Ah * 12V = 1800Wh
    const num12VBatteries = Math.ceil((recBatteryAh24V * 24) / (12 * 150));

    return (
        <div className="sizing-calculator">
            <h2>System Sizing Calculator</h2>

            <div className="appliance-input">
                <input
                    type="text"
                    placeholder="Appliance Name"
                    value={newAppliance.name}
                    onChange={e => setNewAppliance({ ...newAppliance, name: e.target.value })}
                />
                <input
                    type="number"
                    placeholder="Watts"
                    value={newAppliance.watts || ''}
                    onChange={e => setNewAppliance({ ...newAppliance, watts: Number(e.target.value) })}
                />
                <input
                    type="number"
                    placeholder="Hours/Day"
                    value={newAppliance.hours || ''}
                    onChange={e => setNewAppliance({ ...newAppliance, hours: Number(e.target.value) })}
                />
                <button onClick={addAppliance}>Add</button>
            </div>

            <div className="appliance-list">
                {appliances.map(app => (
                    <div key={app.id} className="appliance-item">
                        <span>{app.name}</span>
                        <span>{app.watts}W x {app.hours}h</span>
                        <button onClick={() => removeAppliance(app.id)}>x</button>
                    </div>
                ))}
            </div>

            {appliances.length > 0 && (
                <div className="recommendations">
                    <h3>Recommendations</h3>
                    <div className="rec-item">
                        <span className="label">Daily Energy:</span>
                        <span className="value">{Math.round(totalWhPerDay)} Wh</span>
                    </div>
                    <div className="rec-item">
                        <span className="label">Peak Load:</span>
                        <span className="value">{totalWatts} W</span>
                    </div>
                    <div className="rec-item">
                        <span className="label">Solar Panels:</span>
                        <span className="value">{recPanelCount} x 250W ({recPanelWatts}W total)</span>
                    </div>
                    <div className="rec-item">
                        <span className="label">Battery Bank (24V):</span>
                        <span className="value">{recBatteryAh24V} Ah</span>
                    </div>
                    <div className="rec-item">
                        <span className="label">12V Batteries Needed:</span>
                        <span className="value">{num12VBatteries} x (12V 150Ah)</span>
                    </div>
                    <div className="rec-item">
                        <span className="label">Inverter Size:</span>
                        <span className="value">{recInverterSize} VA</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SizingCalculator;
