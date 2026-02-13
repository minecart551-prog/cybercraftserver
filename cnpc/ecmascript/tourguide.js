// === Tour Guide NPC Script - Shared Group Tour ===

// Global tour state - shared by all players
var currentTourStep = 0;
var isMoving = false;
var pathProgress = 0;
var playersOnTour = {}; // Track which players are on the tour

var tourStops = [
    { msg: "Are you ready for a tour?" }, 
    { msg: "Start with catching about 5 fishes. You'll need it to trade for some money." },
    { msg: "Ready for next location?" },
    { msg: "Let's now go to the second level.", path: [[2338, -48, 848],
     [2367, -41, 848], 
     [2388, -41, 785],
     [2462, -41, 842]
     ] },
    { msg: "Take the elevator to second level, I'll be waiting for you up there", coords: [2461, 47, 843], teleport: true },
    { msg: "Here at Owen's market you can trade fish for emeralds", path: [ [2429, 42, 861],[2424, 42, 869] ] },
    { msg: "Also Save your Respawn Location with the Bed over there, and store your excess items in the Enderchest" },
    { msg: "Now you can buy a gun and ammos to do some gigs", coords: [2435, 42, 880] },
    { msg: "Ready for next location?" },
    { msg: "Here you can get more info about Replicants hunting and rewards", path: [[2427, 42, 870],[2425, 42, 845]] },
    { msg: "Replicants also drop Restaurant Ingredients that you can use at Restaurant job" },
    { msg: "In here is a drones shop, you can hire them to assist you with hunting replicants", coords: [2432, 42, 833] },
    { msg: "Over here is a money exchange", path: [[2421, 42, 834],[2428, 42, 815]] },
    { msg: "You can buy your beginner apartments here, you should be able to afford one after doing some gigs", coords: [2427, 42, 806] },
    { msg: "Over here is a cars shop", coords: [2427, 42, 806] },
    { msg: "You can also buy seeds and grow crops to make profits, Sobiezója also sell decorational items", path: [[2419, 42, 809],[2390, 42, 760]] },
    { msg: "Ready for next location?" },
    { msg: "Now we will go check out the delivery job", path: [[2426, 42, 859],[2503, 42, 843],[2497, 42,846]] },
    { msg: "You can check the guides here", coords: [2497, 42,846] },
    { msg: "The Neonites are the first level enemy you will deal with, after that are the drones you see around here, the same enemy type will defend each other so watch out for nearby enemies", coords: [2546, 42, 831] },
    { msg: "Over here we have a furniture store", coords: [2566, 42, 886] },
    { msg: "Now we will check out the beginner apartments, your room number will be assigned on your key. You can place and break blocks in your apartment and grow your plants as well", path: [[2549, 42, 887],[2598, 42, 980]] },
    { msg: "Let's go downstair and check out the boatdock", coords: [2589, 37, 971] },
    { msg: " ", coords: [2589, -51, 971],teleport:true },
    { msg: "follow me this way", path: [[2603, -46, 976],[2603, -46, 1109],[2680, -52, 1125],[2750, -47, 1069],[2760, -52, 1066]] },
    { msg: "Here's the boatdock, the fishing job still needs some updates where when you travel further you'll catch more valuable fishes. But you can just try the boats for now. Becareful not going to far bc you'll reach the border and the ship will stuck outside, when youre ready come back here and ill show you the Metro", coords: [2760, -52, 1066] },
    { msg: "Ready for next location?" },
    { msg: "Ok let's now go check out the Metro", path: [[2667, -52, 1125],[2616, -51, 1111],[2586, -35, 1045],[2577, -35, 1033]] },
    { msg: " ", coords: [2564, -5, 1032],teleport:true },
    { msg: "all the vending machines you can use", coords: [2564, -5, 1032],},
    { msg: "From here you can travel to different areas of the city, if you ever get lost, follow the markers on the map. That's the end of our tour, thanks for joining us, Have fun exploring!", coords: [2556, -5, 1032],},

    
    { msg: "end", coords: [2325, -48, 855], teleport: true }
];

function interact(e) {
    var npc = e.npc;
    var player = e.player;
    var uuid = player.getUUID();

    // Add player to tour if not already on it
    if (!playersOnTour[uuid]) {
        playersOnTour[uuid] = true;
    }

    // Block interaction if NPC is still moving
    if (isMoving) {
        player.message("§c[Tour Guide] Please wait, I'm still moving to the next location!");
        return;
    }

    // Progress to next step
    if (currentTourStep < tourStops.length) {
        var stop = tourStops[currentTourStep];
        npc.say(stop.msg);

        if (stop.coords || stop.path) {
            if (stop.teleport) {
                // Teleport instantly
                var target = stop.coords ? stop.coords : stop.path[stop.path.length - 1];
                npc.setPosition(target[0], target[1], target[2]);
                isMoving = false; // Teleport is instant
                
                if (currentTourStep === tourStops.length - 1) {
                    npc.getWorld().spawnClone(2325, -48, 855, 3, "Tour Guide");
                    npc.despawn();
                    // Reset for next tour
                    currentTourStep = 0;
                    playersOnTour = {};
                    return;
                }
            } else if (stop.coords) {
                // Walk to location
                npc.navigateTo(stop.coords[0], stop.coords[1], stop.coords[2], 7);
                isMoving = true;
            } else if (stop.path) {
                // Start path
                pathProgress = 0;
                var wp = stop.path[pathProgress];
                npc.navigateTo(wp[0], wp[1], wp[2], 7);
                isMoving = true;
            }
        }

        currentTourStep++;
    }
}

function tick(e) {
    var npc = e.npc;

    if (!isMoving) return;

    var step = currentTourStep - 1; // Current stop (we already incremented)
    if (step < 0 || step >= tourStops.length) return;
    
    var stop = tourStops[step];
    if (!stop) return;

    // Handle waypoint paths
    if (stop.path) {
        if (pathProgress >= stop.path.length) {
            // Finished all waypoints
            isMoving = false;
            return;
        }

        var wp = stop.path[pathProgress];
        var dx = npc.getX() - wp[0];
        var dy = npc.getY() - wp[1];
        var dz = npc.getZ() - wp[2];
        var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < 2) { 
            // Reached waypoint
            pathProgress++;
            if (pathProgress < stop.path.length) {
                var nextWp = stop.path[pathProgress];
                npc.navigateTo(nextWp[0], nextWp[1], nextWp[2], 7);
            } else {
                // All waypoints reached
                isMoving = false;
            }
        } else if (!npc.isNavigating()) {
            // Retry if stuck
            npc.navigateTo(wp[0], wp[1], wp[2], 7);
        }
    }

    // Handle single coordinate stops
    if (stop.coords && !stop.path && !stop.teleport) {
        var dx2 = npc.getX() - stop.coords[0];
        var dy2 = npc.getY() - stop.coords[1];
        var dz2 = npc.getZ() - stop.coords[2];
        var dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2 + dz2 * dz2);

        if (dist2 < 2) {
            isMoving = false;
        } else if (!npc.isNavigating()) {
            npc.navigateTo(stop.coords[0], stop.coords[1], stop.coords[2], 7);
        }
    }
}