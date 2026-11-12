<?php
// Single-rider route planning. This endpoint never changes delivery status or stock.
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth_check.php';
require_once __DIR__ . '/../helpers/location.php';
require_once __DIR__ . '/../helpers/customer_requests.php';

setJsonHeaders();
$method = $_SERVER['REQUEST_METHOD'];
$user = requireAuth(['admin', 'deliverer']);
$db = getDB();

function routeError(string $message, int $code = 400): never { sendError($message, $code); }
function roadRequest(string $path, string $operation): array {
    $base = rtrim(bomsEnvValue('BOMS_OSRM_BASE_URL') ?? 'https://router.project-osrm.org', '/');
    $curl = curl_init($base . $path);
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_CONNECTTIMEOUT => 7, CURLOPT_HTTPHEADER => ['Accept: application/json','User-Agent: BOMS-EVAgas/1.0 (single-rider route planning)']]);
    $raw = curl_exec($curl); $status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE); $error=curl_error($curl); $errno=curl_errno($curl); curl_close($curl);
    if ($raw === false) {
        error_log("BOMS OSRM {$operation} connection failed (cURL {$errno}).");
        if (in_array($errno, [6, 7], true)) routeError('Routing provider cannot be reached from this server. Check its Internet/DNS access or configure BOMS_OSRM_BASE_URL.', 503);
        if ($errno === 28) routeError('Routing provider timed out. Please try again shortly.', 504);
        routeError('Routing provider request failed. Please try again later.', 503);
    }
    $data = is_string($raw) ? json_decode($raw, true) : null;
    if ($status === 429) routeError('Routing provider is busy. Please wait a moment and try again.', 503);
    if ($status >= 500) routeError('Routing provider is temporarily unavailable. Please try again later.', 503);
    if ($status !== 200 || !is_array($data) || ($data['code'] ?? '') !== 'Ok') {
        error_log("BOMS OSRM {$operation} returned HTTP {$status}: {$error}");
        routeError('No road route is available for the selected delivery locations.');
    }
    return $data;
}
function geocodeRequest(string $path): array {
    $base = rtrim(bomsEnvValue('BOMS_GEOCODER_BASE_URL') ?? 'https://nominatim.openstreetmap.org', '/');
    $curl = curl_init($base . $path);
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>15, CURLOPT_CONNECTTIMEOUT=>5, CURLOPT_HTTPHEADER=>['Accept: application/json','User-Agent: BOMS-EVAgas/1.0 (delivery location confirmation)']]);
    $raw=curl_exec($curl); $status=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE); curl_close($curl); $data=is_string($raw)?json_decode($raw,true):null;
    if($status!==200||!is_array($data)) routeError('Location validation service is unavailable. Please try again later.',503); return $data;
}
function isMalilipot(array $place): bool {
    $address=$place['address']??[]; $text=strtolower(implode(' ',array_filter([$address['town']??'', $address['city']??'', $address['municipality']??'', $address['county']??'', $place['display_name']??''])));
    return str_contains($text,'malilipot') && str_contains($text,'albay');
}
function coordinateString(array $points): string { return implode(';', array_map(fn($p) => $p['longitude'] . ',' . $p['latitude'], $points)); }
function validRoutePoint(array $point): bool { return isset($point['latitude'],$point['longitude']) && is_numeric($point['latitude']) && is_numeric($point['longitude']) && (float)$point['latitude'] >= -90 && (float)$point['latitude'] <= 90 && (float)$point['longitude'] >= -180 && (float)$point['longitude'] <= 180; }
function twoOpt(array $order, array $matrix): array {
    $changed = true; $n = count($order);
    while ($changed) { $changed = false; for ($i=1; $i<$n-1; $i++) for ($k=$i+1; $k<$n; $k++) {
        $a=$order[$i-1]; $b=$order[$i]; $c=$order[$k]; $d=$order[$k+1] ?? null;
        $before=$matrix[$a][$b]+($d===null?0:$matrix[$c][$d]); $after=$matrix[$a][$c]+($d===null?0:$matrix[$b][$d]);
        if ($after < $before) { $order=array_merge(array_slice($order,0,$i), array_reverse(array_slice($order,$i,$k-$i+1)), array_slice($order,$k+1)); $changed=true; }
    }} return $order;
}

if ($method === 'GET' && isset($_GET['mine'])) {
    if ($user['role'] !== 'deliverer') routeError('Access denied.', 403);
    $stmt=$db->prepare("SELECT r.*, bl.location_name, bl.latitude AS start_latitude, bl.longitude AS start_longitude FROM delivery_routes r JOIN branch_locations bl ON bl.branch_id=r.branch_id WHERE r.rider_id=? AND r.route_status='Planned' ORDER BY r.created_at DESC LIMIT 1");
    $stmt->execute([$user['user_id']]); $route=$stmt->fetch();
    if (!$route) sendSuccess(['route'=>null]);
    $stops=$db->prepare("SELECT s.stop_sequence,d.id,d.customer_name,d.customer_phone,d.customer_address,d.delivery_status,d.latitude,d.longitude FROM delivery_route_stops s JOIN deliveries d ON d.id=s.delivery_id WHERE s.route_id=? ORDER BY s.stop_sequence");
    $stops->execute([$route['id']]);
    $route['stops']=$stops->fetchAll();
    $route['geometry']=json_decode($route['geometry_json'] ?? 'null', true);
    $route['start']=['name'=>$route['location_name'],'latitude'=>(float)$route['start_latitude'],'longitude'=>(float)$route['start_longitude']];
    unset($route['geometry_json'],$route['start_latitude'],$route['start_longitude']);
    sendSuccess(['route'=>$route]);
}

if ($method !== 'POST' || $user['role'] !== 'admin') routeError('Method not allowed.', 405);
$body=json_decode(file_get_contents('php://input'), true) ?: [];
$action=$body['action'] ?? 'plan';

if ($action === 'eligible') {
    $riderId=(int)($body['rider_id'] ?? 0); if (!$riderId) routeError('A rider is required.');
    $r=$db->prepare("SELECT id FROM users WHERE id=? AND role='deliverer' AND branch_id=? AND status='Active'"); $r->execute([$riderId,$user['branch_id']]); if (!$r->fetch()) routeError('Rider not found in your branch.',404);
    $reviewFilter = customerRequestSchemaReady($db) ? " AND request_status='Approved'" : '';
    $s=$db->prepare("SELECT id,customer_name,customer_address,delivery_status,latitude,longitude,location_confirmed FROM deliveries WHERE branch_id=? AND assigned_to=? AND delivery_status IN ('Pending','On the way'){$reviewFilter} ORDER BY created_at"); $s->execute([$user['branch_id'],$riderId]); sendSuccess(['deliveries'=>$s->fetchAll()]);
}

if ($action === 'confirm_location') {
    $id=(int)($body['delivery_id'] ?? 0); $lat=filter_var($body['latitude'] ?? null,FILTER_VALIDATE_FLOAT); $lng=filter_var($body['longitude'] ?? null,FILTER_VALIDATE_FLOAT);
    if (!$id || $lat===false || $lng===false || $lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) routeError('A valid location is required.');
    try { bomsValidateMalilipotCoordinates((float)$lat, (float)$lng); } catch (RuntimeException $error) { routeError($error->getMessage(), str_contains($error->getMessage(), 'unavailable') ? 503 : 400); }
    $approvalFilter = customerRequestSchemaReady($db) ? " AND request_status='Approved'" : '';
    $s=$db->prepare("UPDATE deliveries SET latitude=?,longitude=?,location_confirmed=1 WHERE id=? AND branch_id=? AND delivery_status IN ('Pending','On the way'){$approvalFilter}"); $s->execute([$lat,$lng,$id,$user['branch_id']]); if(!$s->rowCount()) routeError('Eligible delivery not found.',404); sendSuccess(['confirmed'=>true]);
}

if ($action === 'search_location') {
    $query=trim((string)($body['query']??'')); if($query==='') routeError('Enter an address to search.');
    $places=geocodeRequest('/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=ph&q='.rawurlencode($query.', Malilipot, Albay, Philippines'));
    $places=array_values(array_filter($places,'isMalilipot'));
    sendSuccess(['locations'=>array_map(fn($p)=>['label'=>$p['display_name'],'latitude'=>(float)$p['lat'],'longitude'=>(float)$p['lon']],$places)]);
}

if ($action !== 'plan') routeError('Invalid route action.');
$riderId=(int)($body['rider_id'] ?? 0); $ids=array_values(array_unique(array_map('intval',$body['delivery_ids'] ?? [])));
if (!$riderId || count($ids)<2) routeError('Select one rider and at least two eligible deliveries.');
$start=$db->prepare('SELECT * FROM branch_locations WHERE branch_id=?'); $start->execute([$user['branch_id']]); $branch=$start->fetch(); if(!$branch) routeError('This branch has no configured route starting location.');
$r=$db->prepare("SELECT id FROM users WHERE id=? AND role='deliverer' AND branch_id=? AND status='Active'"); $r->execute([$riderId,$user['branch_id']]); if(!$r->fetch()) routeError('Rider not found in your branch.',404);
$ph=implode(',',array_fill(0,count($ids),'?')); $reviewFilter = customerRequestSchemaReady($db) ? " AND request_status='Approved'" : ''; $q=$db->prepare("SELECT id,customer_name,customer_address,latitude,longitude FROM deliveries WHERE id IN ($ph) AND branch_id=? AND assigned_to=? AND delivery_status IN ('Pending','On the way') AND location_confirmed=1{$reviewFilter}"); $q->execute([...$ids,$user['branch_id'],$riderId]); $stops=$q->fetchAll(); if(count($stops)!==count($ids)) routeError('Every selected delivery must be assigned, eligible, and have a confirmed Malilipot location.');
$points=array_merge([['latitude'=>$branch['latitude'],'longitude'=>$branch['longitude']]],$stops);
foreach($points as $point) if(!validRoutePoint($point)) routeError('A delivery or branch starting location has invalid coordinates.');
$table=roadRequest('/table/v1/driving/'.coordinateString($points).'?annotations=distance,duration','distance-table'); $matrix=$table['durations'] ?? [];
if(count($matrix)!==count($points)) routeError('Routing provider returned incomplete road-distance data.',503);
foreach($matrix as $row) if(count($row)!==count($points) || in_array(null,$row,true)) routeError('No road route is available between one or more selected stops.');
$order=[0]; $remaining=array_keys($stops); while($remaining){$last=end($order); usort($remaining,fn($a,$b)=>$matrix[$last][$a+1]<=>$matrix[$last][$b+1]); $next=array_shift($remaining)+1; $order[]=$next;} $order=twoOpt($order,$matrix);
$orderedStops=[]; foreach(array_slice($order,1) as $pointIndex)$orderedStops[]=$stops[$pointIndex-1]; $route=roadRequest('/route/v1/driving/'.coordinateString(array_map(fn($i)=>$points[$i],$order)).'?overview=full&geometries=geojson','route-geometry'); $road=$route['routes'][0] ?? null;
if(!$road || empty($road['geometry']['coordinates'])) routeError('Routing provider did not return a usable road route.',503);
$db->beginTransaction(); try { $db->prepare("UPDATE delivery_routes SET route_status='Archived' WHERE rider_id=? AND route_status='Planned'")->execute([$riderId]); $i=$db->prepare('INSERT INTO delivery_routes (branch_id,rider_id,created_by,total_distance_m,total_duration_s,geometry_json) VALUES (?,?,?,?,?,?)'); $i->execute([$user['branch_id'],$riderId,$user['user_id'],(int)$road['distance'],(int)$road['duration'],json_encode($road['geometry'])]); $routeId=(int)$db->lastInsertId(); $si=$db->prepare('INSERT INTO delivery_route_stops (route_id,delivery_id,stop_sequence) VALUES (?,?,?)'); foreach($orderedStops as $n=>$stop)$si->execute([$routeId,$stop['id'],$n+1]); $db->commit(); sendSuccess(['route_id'=>$routeId,'stops'=>$orderedStops,'distance_m'=>(int)$road['distance'],'duration_s'=>(int)$road['duration'],'geometry'=>$road['geometry'],'start'=>['name'=>$branch['location_name'],'latitude'=>(float)$branch['latitude'],'longitude'=>(float)$branch['longitude']]],201); } catch(Throwable $e){if($db->inTransaction())$db->rollBack(); error_log('BOMS route plan save failed.'); routeError('Route could not be saved.',500);}
