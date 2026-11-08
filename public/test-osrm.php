
<?php

$url = 'https://router.project-osrm.org/route/v1/driving/13.388860,52.517037;13.397634,52.529407?overview=false';

$ch = curl_init($url);

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_USERAGENT => 'BOMS-RouteTest/1.0'
]);

$response = curl_exec($ch);

$result = [
    'HTTP Status' => curl_getinfo($ch, CURLINFO_HTTP_CODE),
    'cURL Error Number' => curl_errno($ch),
    'cURL Error' => curl_error($ch),
    'Response Received' => $response !== false,
    'Response' => $response
];

curl_close($ch);

header('Content-Type: application/json');
echo json_encode($result, JSON_PRETTY_PRINT);
