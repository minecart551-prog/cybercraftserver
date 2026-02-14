//DOOR SCRIPT - Works with lockandblock:key
// Uses merged keyRegistry structure
function init(event){
    event.block.setBlockModel("minecraft:iron_door");
}
function interact(t){
    t.setCanceled(true);
    
    var player = t.player;
    var item = player.getMainhandItem();
    var worldData = t.block.world.getStoreddata();
    var doorCoord = getDoorCoord(t.block.getPos());
    
    // Handle key interaction
    if(item && !item.isEmpty() && item.getName() == "lockandblock:key"){
        handleKeyInteraction(t, player, item, worldData, doorCoord);
        return;
    }
    
    // Admin bedrock tool - show/reset pairing
    if(item && !item.isEmpty() && item.getName() == "minecraft:bedrock"){
        handleAdminTool(t, player, worldData, doorCoord);
    }
}

function handleKeyInteraction(t, player, item, worldData, doorCoord){
    var keyID = getKeyID(item.getItemNbt());
    
    if(!keyID){
        keyID = registerNewKey(t, player, item, worldData);
        if(!keyID) return;
    }
    
    // Initialize registry if needed
    if(!worldData.has("keyRegistry")){
        worldData.put("keyRegistry", JSON.stringify({}));
    }
    
    var keyRegistry = JSON.parse(worldData.get("keyRegistry"));
    
    // Check if key exists in registry
    if(!keyRegistry[keyID]){
        player.message("§cThis key is not registered!");
        player.message("§7Please register it at a Key Registration Block first.");
        return;
    }
    
    // Ensure doorCoords is an array
    if(!keyRegistry[keyID].doorCoords){
        keyRegistry[keyID].doorCoords = [];
    }
    
    // Check if this door is already paired with ANY key
    var pairedKeyID = findPairedKey(keyRegistry, doorCoord);
    
    // If door is already paired with THIS key, just toggle it
    if(pairedKeyID == keyID){
        // Record last user who successfully opened the door
        keyRegistry[keyID].lastUser = player.getDisplayName();
        worldData.put("keyRegistry", JSON.stringify(keyRegistry));
        
        toggleDoor(t.block);
        return;
    }
    
    // If door is paired with a DIFFERENT key, reject
    if(pairedKeyID && pairedKeyID != keyID){
        player.message("§cThis door is already paired with another key!");
        return;
    }
    
    // Door is unpaired, add it to this key's door list
    keyRegistry[keyID].doorCoords.push(doorCoord);
    
    // Record last user when pairing
    keyRegistry[keyID].lastUser = player.getDisplayName();
    worldData.put("keyRegistry", JSON.stringify(keyRegistry));
    
    player.message("§aDoor paired with key: §f" + item.getDisplayName());
    player.message("§7Door Location: " + doorCoord);
    player.message("§7Total doors on this key: " + keyRegistry[keyID].doorCoords.length);
    toggleDoor(t.block);
}

function handleAdminTool(t, player, worldData, doorCoord){
    if(!worldData.has("keyRegistry")){
        player.message("§7Door is not paired - Location: " + doorCoord);
        return;
    }
    
    var keyRegistry = JSON.parse(worldData.get("keyRegistry"));
    var pairedKeyID = findPairedKey(keyRegistry, doorCoord);
    
    if(!pairedKeyID){
        player.message("§7Door is not paired - Location: " + doorCoord);
        return;
    }
    
    var pairedKey = keyRegistry[pairedKeyID];
    
    player.message("§e=== Door Info ===");
    player.message("§aLocation: §f" + doorCoord);
    player.message("§aPaired Key ID: §f" + pairedKeyID);
    player.message("§aKey Name: §f" + pairedKey.name);
    player.message("§aTotal doors on key: §f" + pairedKey.doorCoords.length);
}

function getKeyID(itemNbt){
    if(!itemNbt) return null;
    try {
        var nbtObj = JSON.parse(cleanNbtJson(itemNbt.toJsonString()));
        return nbtObj.tag && nbtObj.tag.RegisteredKeyID ? nbtObj.tag.RegisteredKeyID : null;
    } catch(e) {
        return null;
    }
}

function cleanNbtJson(nbtString){
    if(!nbtString) return "{}";
    return nbtString.replace(/:\s*(-?\d+)[bBsSlLfFdD]/g, ": $1")
                    .replace(/:\s*(-?\d+\.\d+)[fFdD]/g, ": $1");
}

function getDoorCoord(pos){
    return pos.getX() + "," + pos.getY() + "," + pos.getZ();
}

function findPairedKey(keyRegistry, doorCoord){
    for(var keyID in keyRegistry){
        if(keyRegistry[keyID].doorCoords){
            for(var i = 0; i < keyRegistry[keyID].doorCoords.length; i++){
                if(keyRegistry[keyID].doorCoords[i] == doorCoord){
                    return keyID;
                }
            }
        }
    }
    return null;
}

function toggleDoor(block){
    block.setOpen(!block.getOpen());
}

function registerNewKey(t, player, item, worldData){
    // Initialize counter if needed
    if(!worldData.has("keyCounter")){
        worldData.put("keyCounter", "0");
    }
    
    // Generate new sequential ID
    var keyCounter = parseInt(worldData.get("keyCounter")) + 1;
    var keyID = keyCounter.toString();
    worldData.put("keyCounter", keyID);
    
    // Create new key with ID in NBT
    var itemNbt = item.getItemNbt();
    var nbtObj = itemNbt ? JSON.parse(cleanNbtJson(itemNbt.toJsonString())) : {id:"lockandblock:key", Count:1};
    if(!nbtObj.tag) nbtObj.tag = {};
    nbtObj.tag.RegisteredKeyID = keyID;
    nbtObj.Count = 1;
    
    var newKey = player.world.createItemFromNbt(t.API.stringToNbt(JSON.stringify(nbtObj)));
    player.setMainhandItem(newKey);
    
    player.message("§aKey auto-registered! ID: §f" + keyID);
    
    // Add to merged registry
    if(!worldData.has("keyRegistry")){
        worldData.put("keyRegistry", JSON.stringify({}));
    }
    
    var keyRegistry = JSON.parse(worldData.get("keyRegistry"));
    keyRegistry[keyID] = {
        name: item.getDisplayName(),
        id: keyID,
        doorCoords: [],
        firstBuyer: null,
        lastUser: null
    };
    worldData.put("keyRegistry", JSON.stringify(keyRegistry));
    
    return keyID;
}

function timer(t){
    if(t.id == 1){
        t.block.setOpen(false);
    }
}