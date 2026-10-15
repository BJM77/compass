#!/usr/bin/env node

/**
 * BDM Compass Health & Uptime Monitor
 * Checks availability, response time, and key HTTP headers.
 */

const TARGET_URL = process.env.UPTIME_TARGET_URL || 'https://bdmcompass.online';
const TIMEOUT_MS = 10000;

async function checkHealth() {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(TARGET_URL, {
      method: 'GET',
      headers: {
        'User-Agent': 'BDM-Compass-Uptime-Monitor/1.0',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;

    if (!res.ok) {
      console.error(`[UPTIME ALERT] ${TARGET_URL} returned HTTP ${res.status} ${res.statusText} (${durationMs}ms)`);
      process.exit(1);
    }

    const html = await res.text();
    const hasExpectedTitle = html.includes('Compass') || html.includes('BDM') || html.includes('<!DOCTYPE html>');

    if (!hasExpectedTitle) {
      console.warn(`[UPTIME WARNING] ${TARGET_URL} returned 200 OK but page content seems unexpected.`);
    }

    console.log(`[UPTIME OK] ${TARGET_URL} responded in ${durationMs}ms (HTTP ${res.status})`);
    process.exit(0);
  } catch (error) {
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;
    console.error(`[UPTIME FAILURE] Could not reach ${TARGET_URL} after ${durationMs}ms:`, error.message);
    process.exit(1);
  }
}

checkHealth();
