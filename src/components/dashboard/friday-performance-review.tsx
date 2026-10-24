"use client";

/**
 * Next Week's Activity (NWA). The Friday FW / Friday performance review was replaced by the
 * Monday NWA form; this module keeps the old export name so existing routes keep working.
 * Legacy Friday submissions are still readable (see nwa/nwa-legacy.tsx and the weekly archive).
 */
import React from 'react';
import { NwaForm, type NwaFormProps } from './nwa/nwa-form';

export type FridayPerformanceReviewProps = NwaFormProps;

export function FridayPerformanceReview(props: FridayPerformanceReviewProps) {
  return <NwaForm {...props} />;
}

export { NwaForm };
