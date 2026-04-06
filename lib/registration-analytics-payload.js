/**
 * Payload for registrations_analytics ONLY.
 * Must never include raw PII (names, contact text, address lines, document numbers, free-text notes, birth date).
 * Country is optional coarse aggregate only (same optional field as on intake for reporting).
 */
export function buildRegistrationAnalyticsInsert({
  branch_id,
  registration_number,
  arrival_date,
  departure_date,
  stay_nights,
  country,
  adults_count,
  children_count,
  infants_count,
  dogs_count,
  other_pets_count,
  has_vehicle,
  has_email,
  has_phone
}) {
  return {
    branch_id,
    registration_number,
    arrival_date,
    departure_date,
    stay_nights,
    country: country ?? null,
    adults_count,
    children_count,
    infants_count,
    dogs_count,
    other_pets_count,
    has_vehicle,
    has_email,
    has_phone,
    breakfast_ordered: false
  };
}
