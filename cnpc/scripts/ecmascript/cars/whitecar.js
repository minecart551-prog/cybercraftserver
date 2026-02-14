var flightTimerId = 20;
var despawnTimerId = 21; // new timer for 1-minute despawn
var step = 0.9;
var pitch, pl, rot;
var motionX = 0, motionY = 0, motionZ = 0;
var decay = 0.05; // momentum decay
var npcYaw = 0;

function init(event) {
    event.npc.ai.stopOnInteract = false;
    event.npc.ai.returnsHome = false;
    npcYaw = event.npc.getRotation();
    event.npc.getStoreddata().put("hadRider", 0);
}

function interact(event) {
    event.npc.addRider(event.player);

    // Mark that this NPC has had a rider
    event.npc.getStoreddata().put("hadRider", 1);

    // Start flight control timer
    event.npc.timers.stop(flightTimerId);
    event.npc.timers.start(flightTimerId, 1, true);

    // Start despawn timer (10 sec test – change to 20*60 for 1 min)
    event.npc.timers.stop(despawnTimerId);
    event.npc.timers.start(despawnTimerId, 20 * 60, false);
}

function toRadians(angle) {
    return angle * (Math.PI / 180);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
    var diff = ((b - a + 540) % 360) - 180;
    return (a + diff * t + 360) % 360;
}

function timer(event) {
    var npc = event.npc;
    var data = npc.getStoreddata();
    var hadRider = data.get("hadRider") == 1;

    // ========= Flight Control =========
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

                // Smoothly rotate NPC toward player's yaw
                npcYaw = lerpAngle(npcYaw, rot, 0.2);
                npc.setRotation(npcYaw);

                // Motion
                var targetX = step * -Math.sin(toRadians(rot));
                var targetZ = step * Math.cos(toRadians(rot));
                var targetY = 0;

                if (pitch >= 20) targetY = -step;     // look up -> move up
                else if (pitch <= -20) targetY = step; // look down -> move down

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

        // === Detect dismount ===
        if (hadRider && riders.length == 0) {
            npc.getWorld().spawnClone(2301, -48, 865, 6, "Whitecar");
            npc.despawn();
        }
    }

    // ========= Despawn after timer =========
    if (event.id == despawnTimerId && hadRider) {
        var riders = npc.getRiders();
        if (riders.length > 0) {
            var player = riders[0];
            player.setMount(null);
            player.setPosition(2301, -48, 865);
        }

        npc.getWorld().spawnClone(2301, -48, 865, 6, "Whitecar");
        npc.despawn();
    }
}