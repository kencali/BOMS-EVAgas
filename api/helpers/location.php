<?php
// Shared delivery-location validation. Customer and Admin locations must pass
// the same Malilipot, Albay coverage check; frontend coordinates are never trusted.

require_once __DIR__ . '/../config/env.php';

function bomsValidCoordinates(mixed $latitude, mixed $longitude): bool {
    return is_numeric($latitude) && is_numeric($longitude)
        && (float)$latitude >= -90 && (float)$latitude <= 90
        && (float)$longitude >= -180 && (float)$longitude <= 180;
}

function bomsIsMalilipot(array $place): bool {
    $address = $place['address'] ?? [];
    $text = strtolower(implode(' ', array_filter([
        $address['town'] ?? '', $address['city'] ?? '', $address['municipality'] ?? '',
        $address['county'] ?? '', $place['display_name'] ?? '',
    ])));
    return str_contains($text, 'malilipot') && str_contains($text, 'albay');
}

function bomsGeocodeRequest(string $path): array {
    $base = rtrim(bomsEnvValue('BOMS_GEOCODER_BASE_URL') ?? 'https://nominatim.openstreetmap.org', '/');
    $curl = curl_init($base . $path);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_HTTPHEADER => ['Accept: application/json', 'User-Agent: BOMS-EVAgas/1.0 (delivery location validation)'],
    ]);
    $raw = curl_exec($curl);
    $status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);
    $data = is_string($raw) ? json_decode($raw, true) : null;
    if ($status !== 200 || !is_array($data)) {
        throw new RuntimeException('Location validation service is unavailable. Please try again later.');
    }
    return $data;
}

function bomsValidateMalilipotCoordinates(float $latitude, float $longitude): array {
    if (!bomsValidCoordinates($latitude, $longitude)) {
        throw new RuntimeException('A valid delivery location is required.');
    }
    $place = bomsGeocodeRequest('/reverse?format=jsonv2&addressdetails=1&lat=' . rawurlencode((string)$latitude) . '&lon=' . rawurlencode((string)$longitude));
    if (!bomsIsMalilipot($place)) {
        throw new RuntimeException('Selected location is outside Malilipot, Albay and cannot be accepted.');
    }
    return $place;
}
