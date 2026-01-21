
import { useState, useEffect } from 'react'
import { X, Thermometer, Timer, Power, Droplets, ShowerHead } from 'lucide-react'
import { startShowerSession, endShowerSession, openValve, markWaterReady, sendDeviceCommand, updateDevice, getSettings } from '../services/api';

export default function DeviceControlModal({ isOpen, onClose, device, isRTL, onUpdate }) {
    const [targetTemp, setTargetTemp] = useState(38)
    const [duration, setDuration] = useState(10)
    const [status, setStatus] = useState('ready')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [elapsedTime, setElapsedTime] = useState(0)
    const [currentSessionId, setCurrentSessionId] = useState(null)
    const [isFahrenheit, setIsFahrenheit] = useState(false)

    // Helper functions for conversion
    const cToF = (c) => (c * 9 / 5) + 32;
    const fToC = (f) => (f - 32) * 5 / 9;

    useEffect(() => {
        // Fetch user preferences for units
        const loadPrefs = async () => {
            try {
                const data = await getSettings();
                const unit = data.settings?.system?.temperatureUnit || 'celsius';
                setIsFahrenheit(unit === 'fahrenheit');
            } catch (e) {
                console.warn("Failed to load settings in modal:", e);
            }
        };
        if (isOpen) loadPrefs();
    }, [isOpen]);

    useEffect(() => {
        let timer;
        if (status === 'showering') {
            const startTime = Date.now();
            timer = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        } else if (status === 'heating') {
            // Mock Heating Timer: 1 minute planned = 1 second wait
            // Example: 10 mins -> 10 seconds wait
            const waitTimeMs = duration * 1000;
            console.log(`Starting heating timer: ${waitTimeMs}ms for ${duration} mins`);

            timer = setTimeout(async () => {
                try {
                    console.log('Heating finished, marking ready...');
                    await markWaterReady(device.deviceId);
                    setStatus('ready');
                    if (onUpdate) onUpdate();
                } catch (e) {
                    console.error('Failed to mark ready:', e);
                }
            }, waitTimeMs);
        } else {
            setElapsedTime(0);
        }
        return () => {
            if (status === 'showering') clearInterval(timer);
            else clearTimeout(timer);
        };
    }, [status, duration, device]);

    const formatTimer = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    useEffect(() => {
        if (device) {
            setTargetTemp(Number(device.targetTemp) || 38)
            // Only set status if it actually exists, otherwise default to offline
            setStatus(device.status || 'offline')
            // If status is undefined or null, we shouldn't assume 'heating'
        }
    }, [device])

    useEffect(() => {
        const handleGlobalUpdate = () => {
            if (device && localStorage.getItem('heating_device_id') !== device.deviceId) {
                // If global manager finished heating this device (cleared from storage)
                // and our local status is still heating, update it.
                // Or simply re-fetch or respect the event.
                // Since GlobalManager fires 'device-update' AFTER clearing storage:
                if (status === 'heating') {
                    setStatus('ready');
                    if (onUpdate) onUpdate(); // Trigger parent refresh if possible
                }
            }
        };

        window.addEventListener('device-update', handleGlobalUpdate);
        return () => window.removeEventListener('device-update', handleGlobalUpdate);
    }, [status, device, onUpdate]);

    // Load session ID from storage on mount (MOVED UP to avoid hook rule violation)
    useEffect(() => {
        if (!device) return;
        const storedSessionId = localStorage.getItem(`session_${device.deviceId}`);
        if (storedSessionId) {
            setCurrentSessionId(storedSessionId);
            setStatus('showering'); // Assume showering if session exists
        }
    }, [device]);

    if (!isOpen || !device) return null

    const handleStartHeating = async () => {
        setLoading(true)
        setError(null)
        try {
            // Heating ONLY sends command + updates status. No Session created yet.
            await sendDeviceCommand(device.deviceId, 'START_HEATING');

            // Should also update target temp (Always in Celsius for backend)
            // Note: targetTemp state tracks the *stored* value (which is C), 
            // but the slider might simply display F.
            // Actually, if we want the slider to be smooth, `targetTemp` should probably follow the UI unit.
            // But to minimize logic drift, let's keep `targetTemp` in Celsius always, 
            // and just convert for the render phase. This avoids "drift" on repeated C<->F conversions.

            await updateDevice(device.deviceId, { target_temp: targetTemp });

            // We locally set status (optimistic UI)
            setStatus('heating');
            if (onUpdate) onUpdate();
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleStop = async () => {
        setLoading(true)
        setError(null)
        try {
            if (status === 'heating' || status === 'ready') {
                // Just stop heating, no session to end
                await sendDeviceCommand(device.deviceId, 'STOP_HEATING');
                setStatus('ready');
            } else if (status === 'showering') {
                // End the active session
                await endShowerSession(device.deviceId, currentSessionId, elapsedTime)
                setCurrentSessionId(null);
                localStorage.removeItem(`session_${device.deviceId}`);
                setStatus('ready');
            }
            if (onUpdate) onUpdate();
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleStartShower = async () => {
        setLoading(true)
        setError(null)
        try {
            // Ensure a session exists (if user skipped heating)
            if (!currentSessionId) {
                const response = await startShowerSession(device.deviceId, targetTemp, duration);
                if (response && response.session && response.session.sessionId) {
                    const sid = response.session.sessionId;
                    setCurrentSessionId(sid);
                    localStorage.setItem(`session_${device.deviceId}`, sid);
                }
            }

            await openValve(device.deviceId)
            setStatus('showering')
            if (onUpdate) onUpdate();
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // Display values
    const displayTemp = isFahrenheit ? cToF(targetTemp) : targetTemp;
    const minTemp = isFahrenheit ? 86 : 30;
    const maxTemp = isFahrenheit ? 113 : 45;
    const step = isFahrenheit ? 1 : 0.5;

    const handleSliderChange = (e) => {
        const val = Number(e.target.value);
        if (isFahrenheit) {
            setTargetTemp(fToC(val));
        } else {
            setTargetTemp(val);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-xl w-full max-w-md p-6" dir={isRTL ? 'rtl' : 'ltr'}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">{device.name}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Status Indicator */}
                <div className="flex flex-col items-center justify-center py-8">
                    {status === 'showering' ? (
                        <div className="text-center">
                            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-4 animate-pulse mx-auto">
                                <ShowerHead className="w-12 h-12 text-blue-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-blue-600 mb-2">
                                {formatTimer(elapsedTime)}
                            </h3>
                            <p className="text-gray-500 animate-pulse">
                                {isRTL ? 'המקלחת פעילה...' : 'Shower in progress...'}
                            </p>
                        </div>
                    ) : (
                        // Default status view
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 ${status === 'heating' ? 'bg-orange-100 animate-pulse' :
                            status === 'ready' ? 'bg-green-100 animate-bounce' :
                                'bg-gray-100'
                            }`}>
                            {/* ... icon logic ... */}
                            {status === 'heating' ? <Thermometer className="w-10 h-10 text-orange-500" /> :
                                status === 'ready' ? <Droplets className="w-10 h-10 text-green-500" /> :
                                    <Power className="w-10 h-10 text-gray-400" />}
                        </div>
                    )}

                    {status !== 'showering' && (
                        <span className={`text-lg font-medium capitalize ${status === 'heating' ? 'text-orange-500' :
                            status === 'ready' ? 'text-green-500' :
                                'text-gray-500'
                            }`}>
                            {status === 'heating' ? (isRTL ? 'מחמם...' : 'Heating...') :
                                status === 'ready' ? (isRTL ? 'מוכן!' : 'Ready!') :
                                    (isRTL ? 'כבוי' : 'Offline')}
                        </span>
                    )}
                </div>


                {/* Temperature Slider */}
                <div>
                    <label className="flex items-center gap-2 mb-2 font-medium">
                        <Thermometer className="w-5 h-5 text-red-500" />
                        {isRTL ? 'טמפרטורה' : 'Temperature'}: {Math.round(displayTemp * 10) / 10}°{isFahrenheit ? 'F' : 'C'}
                    </label>
                    <input
                        type="range"
                        min={minTemp}
                        max={maxTemp}
                        step={step}
                        value={displayTemp}
                        onChange={handleSliderChange}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        disabled={status === 'heating' || status === 'showering'}
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>{minTemp}°{isFahrenheit ? 'F' : 'C'}</span>
                        <span>{maxTemp}°{isFahrenheit ? 'F' : 'C'}</span>
                    </div>
                </div>

                {/* Duration Slider */}
                <div>
                    <label className="flex items-center gap-2 mb-2 font-medium">
                        <Timer className="w-5 h-5 text-blue-500" />
                        {isRTL ? 'משך זמן' : 'Duration'}: {duration} min
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="30"
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        disabled={status === 'heating' || status === 'showering'}
                    />
                </div>

                {/* Controls */}
                <div className="grid grid-cols-2 gap-4 pt-4">
                    <button
                        onClick={status === 'heating' ? handleStop : handleStartHeating}
                        disabled={loading || status === 'showering'}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${status === 'heating'
                            ? 'border-orange-500 bg-orange-50 text-orange-600'
                            : 'border-gray-200 hover:border-orange-200 hover:bg-orange-50'
                            } `}
                    >
                        <Power className="w-8 h-8 mb-2" />
                        <span className="font-medium">
                            {status === 'heating'
                                ? (isRTL ? 'עצור חימום' : 'Stop Heating')
                                : (isRTL ? 'התחל חימום' : 'Start Heating')}
                        </span>
                    </button>

                    <button
                        onClick={status === 'showering' ? handleStop : handleStartShower}
                        disabled={loading || (status !== 'ready' && status !== 'showering')}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${status === 'showering'
                            ? 'border-blue-500 bg-blue-50 text-blue-600'
                            : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50'
                            } `}
                    >
                        <Droplets className="w-8 h-8 mb-2" />
                        <span className="font-medium">
                            {status === 'showering'
                                ? (isRTL ? 'סיים מקלחת' : 'End Shower')
                                : (isRTL ? 'התחל מקלחת' : 'Start Shower')}
                        </span>
                    </button>
                </div>

                {error && <p className="text-red-500 text-center text-sm">{error}</p>}

                <div className="mt-4 text-center text-xs text-gray-300">
                    System v2.1 (Debug Mode)
                </div>
            </div>
        </div>
    )
}
