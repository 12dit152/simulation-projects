import React, { useState, useEffect, useRef } from 'react';
import SunControl from './SunControl';
import SystemDiagram from './SystemDiagram';
import SystemEditor from './SystemEditor';
import SizingCalculator from './SizingCalculator';
import { calculateSystemState, DEFAULT_CONFIG, SystemConfig, SystemState } from './SimulationEngine';
import './App.css';

function App() {
  const [sunIntensity, setSunIntensity] = useState(0);
  const [timeOfDay, setTimeOfDay] = useState(9); // Start at 9 AM when sun begins
  const [acLoad, setAcLoad] = useState(100);
  const [systemMode, setSystemMode] = useState<'OFF_GRID' | 'ON_GRID' | 'HYBRID'>('HYBRID');

  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [batteryLevel, setBatteryLevel] = useState(DEFAULT_CONFIG.batteryCapacityAh * DEFAULT_CONFIG.batteryVoltage * 0.5);

  const lastTimeRef = useRef(Date.now());

  useEffect(() => {
    const maxWh = config.batteryCapacityAh * config.batteryVoltage;
    setBatteryLevel(prev => Math.min(prev, maxWh));
  }, [config.batteryCapacityAh, config.batteryVoltage]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const dtSeconds = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      setBatteryLevel(prevLevel => {
        const state = calculateSystemState(sunIntensity, acLoad, prevLevel, config, timeOfDay, systemMode);
        const effectiveDtHours = (dtSeconds * 10) / 3600; // 10x speed instead of 100x
        const energyChange = state.netBatteryFlow * effectiveDtHours;
        const maxWh = config.batteryCapacityAh * config.batteryVoltage;
        let newLevel = prevLevel + energyChange;
        newLevel = Math.max(0, Math.min(newLevel, maxWh));
        return newLevel;
      });

    }, 100);

    return () => clearInterval(interval);
  }, [sunIntensity, acLoad, config, timeOfDay, systemMode]);

  const currentSystemState = calculateSystemState(sunIntensity, acLoad, batteryLevel, config, timeOfDay, systemMode);

  const handleSunChange = (intensity: number, time: number) => {
    setSunIntensity(intensity);
    setTimeOfDay(time);
  };

  return (
    <div className="app-container">
      <header>
        <h1>Odisha Solar Planner</h1>
        <p>Advanced Simulation & Sizing</p>
      </header>

      <main className="main-layout">
        <div className="left-panel">
          <div className="controls-section">
            <div className="mode-selector" style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
              <button
                className={systemMode === 'OFF_GRID' ? 'active' : ''}
                onClick={() => setSystemMode('OFF_GRID')}
                style={{ padding: '10px', background: systemMode === 'OFF_GRID' ? '#4CAF50' : '#333', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
              >
                Off-Grid
              </button>
              <button
                className={systemMode === 'ON_GRID' ? 'active' : ''}
                onClick={() => setSystemMode('ON_GRID')}
                style={{ padding: '10px', background: systemMode === 'ON_GRID' ? '#4CAF50' : '#333', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
              >
                On-Grid
              </button>
              <button
                className={systemMode === 'HYBRID' ? 'active' : ''}
                onClick={() => setSystemMode('HYBRID')}
                style={{ padding: '10px', background: systemMode === 'HYBRID' ? '#4CAF50' : '#333', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
              >
                Hybrid
              </button>
            </div>

            <SunControl onSunPositionChange={handleSunChange} />

            <div className="load-control">
              <label>AC Load: {acLoad} W</label>
              <input
                type="range"
                min="0"
                max="2000"
                value={acLoad}
                onChange={(e) => setAcLoad(Number(e.target.value))}
              />
            </div>
          </div>

          <SystemEditor config={config} onConfigChange={setConfig} />

          <SizingCalculator />
        </div>

        <div className="right-panel">
          <SystemDiagram
            state={currentSystemState}
            config={config}
            batteryLevel={batteryLevel}
            systemMode={systemMode}
          />

          <div className="stats-panel">
            <div className="stat">
              <span className="label">Wire Status</span>
              <span className="value" style={{ color: currentSystemState.wireAnalysis.isSafe ? '#2ecc71' : '#e74c3c' }}>
                {currentSystemState.wireAnalysis.message}
              </span>
            </div>
            <div className="stat">
              <span className="label">Grid Status</span>
              <span className="value" style={{ color: currentSystemState.gridActive ? '#3498db' : '#7f8c8d' }}>
                {currentSystemState.gridActive ? 'ACTIVE' : 'STANDBY'}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
