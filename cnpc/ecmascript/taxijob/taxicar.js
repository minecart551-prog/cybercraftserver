var flightTimerId = 20;
var checkTimerId = 21; // new timer for restricted item checks
var step = 1.3;
var pitch, pl, rot;
var motionX = 0, motionY = 0, motionZ = 0;
var decay = 0.05;
var npcYaw = 0;

var locations = [
    {x:2310, y:-30, z:655},
    {x:2380, y:40, z:1045},
    {x:2471, y:40, z:1139},
    {x:2692, y:-15, z:666},
    {x:2445, y:-52, z:1352},
    {x:2672, y:-52, z:1524},
    {x:2708, y:-52, z:402},
    {x:2416, y:54, z:-135},
    {x:2545, y:53, z:-256},
    {x:2088, y:-52, z:-389},
    {x:2229, y:130, z:1968},
    {x:2281, y:-2, z:2217},
    {x:2140, y:178, z:1177},
    {x:2237, y:152, z:932},
    {x:2455, y:116, z:630},
    {x:1983, y:75, z:-649},
    {x:1852, y:145, z:-756},
    {x:2099, y:189, z:-1107},
    {x:2158, y:84, z:-841},
    {x:2370, y:84, z:-1027},
    {x:1724, y:-52, z:-328},
    {x:1297, y:3, z:-336},
    {x:1399, y:58, z:-242},
    {x:1198, y:65, z:-229},
    {x:1064, y:64, z:-330},
    {x:1375, y:-22, z:-568},
    {x:959, y:-5, z:-308},
    {x:959, y:-5, z:-203},
    {x:1134, y:107, z:-168},
    {x:1181, y:103, z:-106},
    {x:1435, y:114, z:-131}
];

var pickup = null;
var arrival = null;
var onPickup = true;

function init(event) {
    event.npc.ai.stopOnInteract = false;
    event.npc.ai.returnsHome = false;
    npcYaw = event.npc.getRotation();
}

function assignNewTrip(npc) {
    var i = Math.floor(Math.random() * locations.length);
    var j;
    do { j = Math.floor(Math.random() * locations.length); } while (j == i);

    pickup = locations[i];
    arrival = locations[j];
    onPickup = true;

    npc.say("§aNew Pickup§r: ("+pickup.x+", "+pickup.y+", "+pickup.z+") " + 
            "§aArrival§r: ("+arrival.x+", "+arrival.y+", "+arrival.z+")");
}

function interact(event) {
    var player = event.player;

    // Initial scan for restricted items
    if (hasRestrictedItem(player)) {
        player.message("§cYou cannot use the taxi with packages!");
        return; // don’t start ride
    }

    event.npc.addRider(player);
    event.npc.getStoreddata().put("hadRider", 1);

    // Start movement control
    event.npc.timers.stop(flightTimerId);
    event.npc.timers.start(flightTimerId, 1, true);

    // Start restricted item scan (every 40 ticks = 2s)
    event.npc.timers.stop(checkTimerId);
    event.npc.timers.start(checkTimerId, 400, true);

    assignNewTrip(event.npc);
}

function toRadians(angle) { return angle * (Math.PI / 180); }
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpAngle(a, b, t) {
    var diff = ((b - a + 540) % 360) - 180;
    return (a + diff * t + 360) % 360;
}

function timer(event) {
    var npc = event.npc;
    var data = npc.getStoreddata();
    var hadRider = data.get("hadRider") == 1;

    if (event.id == flightTimerId) {
        var riders = npc.getRiders();
        var usingControl = false;

        if (riders.length > 0) {
            pl = riders[0];
            if (pl.mainhandItem && pl.mainhandItem.displayName == "Flight Control") {
                usingControl = true;

                pitch = Number(pl.getPitch().toFixed(2));
                rot = Number(pl.getRotation().toFixed(2));
                if (rot < 0) rot += 360;

                npcYaw = lerpAngle(npcYaw, rot, 0.2);
                npc.setRotation(npcYaw);

                var targetX = step * -Math.sin(toRadians(rot));
                var targetZ = step * Math.cos(toRadians(rot));
                var targetY = 0;

                if (pitch >= 20) targetY = -step;
                else if (pitch <= -20) targetY = step;

                motionX = lerp(motionX, targetX, 0.2);
                motionY = lerp(motionY, targetY, 0.2);
                motionZ = lerp(motionZ, targetZ, 0.2);
            }
        }

        if (!usingControl) {
            motionX = lerp(motionX, 0, decay);
            motionY = lerp(motionY, 0, decay);
            motionZ = lerp(motionZ, 0, decay);
        }

        npc.setMotionX(motionX);
        npc.setMotionY(motionY);
        npc.setMotionZ(motionZ);

        // Detect dismount
        if (hadRider && riders.length == 0) {
            npc.getWorld().spawnClone(2301, -48, 865, 6, "Whitecar");
            npc.despawn();
            return;
        }

        // Trip progression
        if (riders.length > 0) {
            var target = onPickup ? pickup : arrival;
            if (isNear(npc, target, 6)) {
                if (onPickup) {
                    riders[0].message("§aPassenger picked up.");
                    onPickup = false;
                } else {
                    var dist = distance(pickup, arrival);
                    var reward = Math.floor(dist / 40);
                    riders[0].message("§aArrived! Distance: "+dist+" §ablocks. Reward: "+reward);
                    riders[0].giveItem("minecraft:emerald", reward);
                    assignNewTrip(npc);
                }
            }
        }
    }

    // === Restricted item check ===
    if (event.id == checkTimerId) {
        var riders = npc.getRiders();
        if (riders.length > 0) {
            var p = riders[0];
            if (hasRestrictedItem(p)) {
                removeRestrictedItems(p);
                p.setMount(null);
                p.message("§cYour package was confiscated and you were removed from the taxi!");
            }
        } else {
            // stop scanning if no rider
            npc.timers.stop(checkTimerId);
        }
    }
}

// === Helpers ===
function hasRestrictedItem(player) {
    var inv = player.getInventory().getItems();
    for (var i = 0; i < inv.length; i++) {
        var item = inv[i];
        if (item != null && item.getName() == "yuushya:package_0") {
            return true;
        }
    }
    return false;
}

function removeRestrictedItems(player) {
    var inv = player.getInventory().getItems();
    for (var i = 0; i < inv.length; i++) {
        var item = inv[i];
        if (item != null && item.getName() == "yuushya:package_0") {
            item.setStackSize(0);
        }
    }
}

function isNear(npc, pos, radius) {
    var dx = npc.getX() - pos.x;
    var dy = npc.getY() - pos.y;
    var dz = npc.getZ() - pos.z;
    return (dx*dx + dy*dy + dz*dz) <= radius*radius;
}

function distance(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    var dz = a.z - b.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
}