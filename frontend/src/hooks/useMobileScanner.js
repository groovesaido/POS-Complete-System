import { useState, useEffect, useRef, useCallback } from 'react';
import { scannerAPI } from '../services/api';
import { playScanSound } from '../utils/sound';

/**
 * Shared hook for polling the mobile barcode scanner app.
 *
 * @param {Object} options
 * @param {Function} [options.onScans] - Called with each batch of new scans.
 *        Should return an array of scans that were NOT handled (to show in the phone panel).
 *        Signature: (scans) => remainingScans[]
 * @param {boolean} [options.soundEnabled=true] - Whether to play notification sounds on new scans.
 * @returns {{ mobileScans, showMobileScans, setShowMobileScans, newScanAlert, setMobileScans }}
 */
export default function useMobileScanner({ onScans, soundEnabled = true } = {}) {
  const [mobileScans, setMobileScans] = useState([]);
  const [showMobileScans, setShowMobileScans] = useState(false);
  const [newScanAlert, setNewScanAlert] = useState(false);
  const lastScanTimeRef = useRef(null);
  const onScansRef = useRef(onScans);
  const soundEnabledRef = useRef(soundEnabled);

  // Keep the callback and options refs in sync without re-triggering the polling effect
  useEffect(() => {
    onScansRef.current = onScans;
  }, [onScans]);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Poll for new scans every 3 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const since = lastScanTimeRef.current || new Date(Date.now() - 60000).toISOString();
        const { data } = await scannerAPI.getRecent(since);
        if (data.scans && data.scans.length > 0) {
          // Update last scan time to the most recent scan (handles dedup via timestamp)
          lastScanTimeRef.current = data.scans[0].scannedAt;

          // Play notification sound (if enabled)
          if (soundEnabledRef.current) {
            playScanSound();
          }

          // Show alert banner for new scans
          setNewScanAlert(true);
          setTimeout(() => setNewScanAlert(false), 3000);

          // Let the component handle the scans (returns scans that weren't handled)
          if (onScansRef.current) {
            const remaining = onScansRef.current(data.scans);
            if (remaining && remaining.length > 0) {
              setMobileScans(prev => [...remaining, ...prev].slice(0, 20));
            }
          } else {
            // Default: store all scans in the phone panel
            setMobileScans(prev => [...data.scans, ...prev].slice(0, 20));
          }
        }
      } catch {
        // Silently fail — scanner might not be configured
      }
    };

    const interval = setInterval(poll, 3000);
    poll(); // do an initial poll immediately

    return () => clearInterval(interval);
  }, []);

  return { mobileScans, showMobileScans, setShowMobileScans, newScanAlert, setMobileScans };
}
