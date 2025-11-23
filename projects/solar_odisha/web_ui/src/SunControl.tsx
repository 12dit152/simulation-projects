import React, { useState, useEffect, useRef } from 'react';
import './SunControl.css';

interface SunControlProps {
    onSunPositionChange: (intensity: number, hour: number) => void;
}

const SunControl: React.FC<SunControlProps> = ({ onSunPositionChange }) => {
    const [angle, setAngle] = useState(45); // 0 = 6am, 45 = 9am, 90 = 12pm, 180 = 6pm
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    const handleMove = (clientX: number, clientY: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        // Visual center of arc is at 150px from top. 
        // Container is 200px high. So center is at rect.top + 150.
        const centerY = rect.top + 150;

        // We want 0 deg at Left (6am), 180 deg at Right (6pm).
        // Standard atan2(y, x) gives 0 at Right.
        // If we flip X (centerX - clientX), then Left is Positive X.
        // atan2(y, x) will be 0 at Left (if y=0).
        const x = centerX - clientX;
        const y = centerY - clientY; // Up is positive

        // Calculate angle in degrees (0 to 180)
        let theta = Math.atan2(y, x) * (180 / Math.PI);

        // Clamp to 0-180
        if (theta < 0) theta = 0;
        if (theta > 180) theta = 180;

        setAngle(theta);
        updateSimulation(theta);
    };

    const updateSimulation = (theta: number) => {
        // Map 0-180 degrees to 6am - 6pm (12 hours)
        const timeOfDay = 6 + (theta / 180) * 12; // 0->6, 180->18

        // Intensity: Parabola peaking at 90 deg
        const intensity = Math.sin(theta * (Math.PI / 180));

        onSunPositionChange(intensity, timeOfDay);
    };

    const onMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        handleMove(e.clientX, e.clientY);
    };

    useEffect(() => {
        const onMouseUp = () => isDragging.current = false;
        const onMouseMove = (e: MouseEvent) => {
            if (isDragging.current) handleMove(e.clientX, e.clientY);
        };

        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('mousemove', onMouseMove);
        return () => {
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('mousemove', onMouseMove);
        };
    }, []);

    // Initial update
    useEffect(() => {
        updateSimulation(angle);
    }, []);

    // Calculate sun position
    const radius = 100; // Reduced to keep inside container
    const sunX = radius * Math.cos(angle * (Math.PI / 180));
    const sunY = radius * Math.sin(angle * (Math.PI / 180));

    return (
        <div className="sun-control-container" ref={containerRef}>
            <div className="sky-arc">
                <div
                    className="sun-icon"
                    style={{
                        // 120 is center of sky-arc (240/2). 
                        // Angle 0 (Left) -> cos=1 -> sunX=100. 120-100-20 = 0. Correct.
                        // Angle 180 (Right) -> cos=-1 -> sunX=-100. 120-(-100)-20 = 200. Correct.
                        transform: `translate(${120 - sunX - 20}px, ${120 - sunY - 20}px)`
                    }}
                    onMouseDown={onMouseDown}
                >
                    ☀️
                </div>
            </div>
            <div className="time-display">
                {/* Calculate time string */}
                {(() => {
                    // Angle 0 = 6am (Left), 180 = 6pm (Right)
                    const hour = 6 + (angle / 180) * 12;
                    const h = Math.floor(hour);
                    const m = Math.floor((hour - h) * 60);
                    return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
                })()}
            </div>
            <div className="slider-container">
                <input
                    type="range"
                    min="0"
                    max="180"
                    value={angle}
                    onChange={(e) => {
                        const newAngle = Number(e.target.value);
                        setAngle(newAngle);
                        updateSimulation(newAngle);
                    }}
                    className="sun-slider"
                />
                <div className="slider-label">Drag Sun or Use Slider</div>
            </div>
        </div>
    );
};

export default SunControl;
