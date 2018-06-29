/*
 * Ranking Task Widget - JavaScript
 * astro.unl.edu
 * v0.0.4 (in active development)
 * 28 June 2018
*/


/*
 *  RankingTask
 */

function RankingTask(rootElement) {

  // The amount of time an item will take to animate to its rest position may vary
  //  depending on its current distance from that position. Regardless of the formula
  //  used, the animation duration will always be between these limits.
  this.minAnimationMilliseconds = 100;
  this.maxAnimationMilliseconds = 200;

  // dragMarginIncursion -- defines the drag limits of an item as a fraction of
  //  the margin around the items' area (rt-items-div)
  this.dragMarginIncursion = 0.75;

  // todo: verify rootElement is a div with correct class, and log meaningful
  //  error if it is not
  
  this._removeChildren(rootElement);
  this._rootElement = rootElement;

  // _heightIsRestricted determines whether to limit the height of content.
  this._heightIsRestricted = (this._rootElement.clientHeight > 0);

  // The root div uses border-box sizing to avoid overflow in the iframe player.
  // The inner div makes it easier to account for the root div's border in laying
  //   out the question and items.
  this._innerDiv = document.createElement("div");
  this._innerDiv.className = "rt-inner-div";
  this._rootElement.appendChild(this._innerDiv);

  this._question = document.createElement("p");
  this._question.className = "rt-question-p";
  this._innerDiv.appendChild(this._question);
  
  this._itemsDiv = document.createElement("div");
  this._itemsDiv.className = "rt-items-div";
  this._innerDiv.appendChild(this._itemsDiv);

  var rt = this;
  this._resizeSensor = new ResizeSensor(this._itemsDiv, function() {
    //console.log("ResizeSensor called for "+rt._rootElement.id);
    if (!rt._isReady) {
      return;
    }
    rt._resetLayout();
    rt._calcRestPositions();
    rt._snapItemsToRest();
  });

  
}

RankingTask.prototype._removeChildren = function(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
};

RankingTask.prototype.initWithURL = function(xmlURL, rankingTaskID) {
  // Initializes the ranking task with an XML file.
  // xmlURL is the XML file that may contain multiple rankingTask nodes.
  // rankingTaskID is the unique id attribute of the rankingTask node to use. 

  this._xmlReq = new XMLHttpRequest();

  var rt = this;
  this._onXMLLoadProxy = function() {
    rt._onXMLLoad(rankingTaskID);
  };
  this._xmlReq.addEventListener("load", this._onXMLLoadProxy);
  this._xmlReq.open("GET", xmlURL);
  this._xmlReq.send();
};

RankingTask.prototype._onXMLLoad = function(rankingTaskID) {
  // Called when the XML file has loaded.
  // This function simply converts the relevant XML node to a JavaScript object
  //  and passes it on to initWithObject().
 
  var obj = {id: rankingTaskID};

  var rtXML = this._xmlReq.responseXML.getElementById(rankingTaskID);

  obj.question = rtXML.getElementsByTagName("question")[0].childNodes[0].nodeValue;
  
  var defNumSel = rtXML.getElementsByTagName("defaultNumSelected");
  if (defNumSel.length > 0) {
    obj.defaultNumSelected = defNumSel[0].childNodes[0].nodeValue;
  }
 
  var itemsXML = rtXML.getElementsByTagName("items")[0].getElementsByTagName("item");

  obj.items = [];
  for (var i = 0; i < itemsXML.length; ++i) {
    var itemXML = itemsXML[i];
    var item = {};
    item.id = itemXML.id;
    item.type = itemXML.getElementsByTagName("type")[0].childNodes[0].nodeValue;
    item.value = itemXML.getElementsByTagName("value")[0].childNodes[0].nodeValue;
    item.src = itemXML.getElementsByTagName("src")[0].childNodes[0].nodeValue;
    obj.items.push(item);    
  }

  // The baseURL is set to the directory of the XML file.
  var baseURL = "";
  var i = this._xmlReq.responseURL.lastIndexOf("/");
  if (i >= 0) {
    baseURL = this._xmlReq.responseURL.slice(0, i+1);
  }
  
  this._xmlReq.removeEventListener("load", this._onXMLLoadProxy); 
  this._xmlReq = null;

  this.initWithObject(obj, baseURL); 
};

RankingTask.prototype.initWithObject = function(obj, baseURL) {
  // Initializes the ranking task with a JavaScript object.
  // The baseURL is used to expand relative resource urls (e.g. an image's source).
  //  Pass an empty string for baseURL to skip this step (i.e. leave it up to the browser).
  // The object is expected to have these properties:
  //   id
  //   question
  //   items (an array)
  //   defaultNumSelected (optional) - a number
  // Each item is expected to have
  //   id - uniquely identifies the item within the items list
  //   type - may be "image"
  //   value (optional) - a number
  // If type is image then the item is expected to have
  //   src - the url for the image
  
  this._isReady = false;
  this._removeChildren(this._itemsDiv);

  this._question.textContent = obj.question;

  // Randomize the order of items (the complete list).
  var shuffledItems = this._shuffle(obj.items);
  
  // Select a subset of items, if specified.
  var numSelected = shuffledItems.length;
  if (obj.defaultNumSelected !== undefined) {
    var n = parseInt(obj.defaultNumSelected);
    if (n >= 2 && n < shuffledItems.length) {
      numSelected = n;
    }
  }
  var selectedItems = shuffledItems.slice(0, numSelected);

  // Create and load the selected items.
  this._itemsCountdown = selectedItems.length;
  this._items = [];
  for (var i = 0; i < this._itemsCountdown; ++i) {
    var itemObj = selectedItems[i];
    if (itemObj.type == "image") {
      const url = new URL(itemObj.src, baseURL);
      var item = new RTImageItem(this, itemObj.id, url.toString());
      item._rt_isAnimating = false;
      item._rt_isBeingDragged = false;
      this._items.push(item);
    }
  }
};

RankingTask.prototype._shuffle = function(array) {
  // Copied from https://stackoverflow.com/a/2450976 (28 June 2018).
  
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
};

RankingTask.prototype._itemIsReady = function(item) {

  // Add item's element, but keep it hidden until all items are ready.
  item._rt_element = item.getElement();
  item._rt_element.style.display = "none";
  this._itemsDiv.appendChild(item._rt_element);

  // Add mouse event listeners for dragging to the item.
  var rt = this;
  item._rt_onMouseMoveProxy = function(e) {
    rt._updateDrag(item, e.clientX);
    e.preventDefault();
  }
  item._rt_onMouseFinishedProxy = function(e) {
    rt._stopDrag(item);
    document.removeEventListener("mousemove", item._rt_onMouseMoveProxy);
    document.removeEventListener("mouseup", item._rt_onMouseFinishedProxy);
    document.removeEventListener("mouseleave", item._rt_onMouseFinishedProxy);
    e.preventDefault();
  }
  item._rt_onMouseDownProxy = function(e) {
    rt._startDrag(item, e.clientX);
    document.addEventListener("mousemove", item._rt_onMouseMoveProxy);
    document.addEventListener("mouseup", item._rt_onMouseFinishedProxy);
    document.addEventListener("mouseleave", item._rt_onMouseFinishedProxy);
    e.preventDefault();
  }
  item._rt_element.addEventListener("mousedown", item._rt_onMouseDownProxy);
  
  this._itemsCountdown -= 1;
  if (this._itemsCountdown == 0) {
    
    // All items ready.
    this._isReady = true;

    // Make items visible.
    for (var i = 0; i < this._items.length; ++i) {
      this._items[i]._rt_element.style.display = "block";
    }

    this._resetLayout();

    // Position the items horizontally.
    this._calcRestPositions();
    this._snapItemsToRest();
  }
};

RankingTask.prototype._resetLayout = function() {
  // This function resets the layout from scratch. It does everything except positioning
  //  the items horizontally.

  var questionBB = this._question.getBoundingClientRect();
  var innerBB = this._innerDiv.getBoundingClientRect();

  this._margin = questionBB.left - innerBB.left;
  
  // When height is unrestricted the height of itemsDiv is determined later, after
  //  inspecting all the items.
  if (this._heightIsRestricted) {
    this._itemsDiv.style.height = (innerBB.height - 3*this._margin - questionBB.height) + "px";
  }

  var itemsBB = this._itemsDiv.getBoundingClientRect();

  // Review the unscaled sizes of the items.
  var widthSum = 0.0;
  var maxHeight = 0.0;
  for (var i = 0; i < this._items.length; ++i) {
    var item = this._items[i];
    var size = item.getRawSize();
    widthSum += size.width;
    if (size.height > maxHeight) {
      maxHeight = size.height;
    }
  }

  // Calculate the max scale such that all items fit vertically.
  var maxHeightScale = 1.0;
  if (this._heightIsRestricted) {
    if (itemsBB.height > 0.0) {
      maxHeightScale = Math.min(itemsBB.height/maxHeight, 1.0);
    }
  }
  
  // Calculate the max scale such that all items fit horizontally.
  var widthAvailable = itemsBB.width - this._margin*(this._items.length - 1);
  var maxWidthScale = widthAvailable/widthSum; 
  
  // Determine the scale to use and apply it to all items.
  var scale = Math.min(maxHeightScale, maxWidthScale);
  widthSum = 0.0;
  maxHeight = 0.0;
  for (var i = 0; i < this._items.length; ++i) {
    var item = this._items[i];
    var element = item._rt_element;
    var size = item.getRawSize();
    var w = scale*size.width;
    item._rt_halfWidth = w/2.0;
    item._rt_width = w;
    element.style.width = w + "px";
    var h =  scale*size.height;
    element.style.height = h + "px";
    widthSum += w;
    if (h > maxHeight) maxHeight = h;
  }
  widthSum += this._margin*(this._items.length - 1);

  // Set items container height in unrestricted case.
  if (!this._heightIsRestricted) {
    this._itemsDiv.style.height = maxHeight + "px";
  }

  // Set quantities used for item layout.
  if (this._heightIsRestricted) {
    this._itemsMidlineY = (itemsBB.height/2.0);
  } else {
    this._itemsMidlineY = maxHeight/2.0;
  }
  this._itemsStartX = (itemsBB.width - widthSum)/2.0;
  this._itemsMinX = -this.dragMarginIncursion*this._margin;
  this._itemsMaxX = itemsBB.width + this.dragMarginIncursion*this._margin;
  this._itemsHalfRange = (this._itemsMaxX - this._itemsMinX)/2.0;

  // Position the items vertically and initialize z ordering.
  for (var i = 0; i < this._items.length; ++i) {
    var item = this._items[i];
    var element = item._rt_element;
    var bb = element.getBoundingClientRect();
    var y = this._itemsMidlineY - (bb.height/2.0);
    element.style.top = y + "px";
    element.style.zIndex = i;
  }
  this._nextZIndex = this._items.length;

};

RankingTask.prototype._snapItemsToRest = function() {
  // This function will snap all items to their final rest positions (_rt_restX),
  //  cancelling all active animations and dragging.
  for (var i = 0; i < this._items.length; ++i) {
    var item = this._items[i];
    var element = item._rt_element;
    this._stopAnimation(item);
    this._stopDrag(item);
    item._rt_currX = item._rt_restX;
    item._rt_currCtrX = item._rt_restX + item._rt_halfWidth;
    element.style.left = item._rt_restX + "px";
  }
};

RankingTask.prototype._calcRestPositions = function() {
  // This function calculates the resting positions of the items (_rt_restX) given
  //  the current answer order (the order of the _items array).
  // It does not actually move the items.
  var x = this._itemsStartX;
  for (var i = 0; i < this._items.length; ++i) {
    var item = this._items[i];
    item._rt_restX = x;
    x += item._rt_width + this._margin;
  }
};

RankingTask.prototype._startAnimation = function(item) {
  // This function starts or extends an item's animation to its rest position.
  //console.log("startAnimation for "+item.getID());
  item._rt_animStartTime = null;
  if (item._rt_isAnimating) {
    return;
  }
  item._rt_isAnimating = true;
  this._requestFrame(item);
};

RankingTask.prototype._requestFrame = function(item) {
  // This helper function is meant to be called only by _startAnimation() and _onFrame().
  var rt = this;
  function onFrameProxy(n) {
    rt._onFrame(item, n);
  }
  item._rt_frameRequestID = window.requestAnimationFrame(onFrameProxy);
};

RankingTask.prototype._stopAnimation = function(item) {
  // This function stops an item's animation immediately. The item's screen position
  //  will not be changed (it remains wherever the animation left it).
  if (!item._rt_isAnimating) {
    return;
  }
  window.cancelAnimationFrame(item._rt_frameRequestID);
  item._rt_isAnimating = false;
};

RankingTask.prototype._onFrame = function(item, now) {
  // This function is called for each animating item.
  //console.log("onFrame for "+item.getID()+", now: "+now);

  if (item._rt_animStartTime === null) {
    // The animation is starting, or has been extended.
    // Calculate the animation parameters.
    
    // Currently using linear animation with duration a function of the distance.
    // todo: change to more naturalistic/pleasing tweening effect

    item._rt_animStartTime = now;
    item._rt_anim_m = item._rt_restX - item._rt_currX;
    item._rt_anim_b = item._rt_currX;

    var t = this.minAnimationMilliseconds + this.maxAnimationMilliseconds*Math.abs(item._rt_anim_m)/this._itemsHalfRange;
    t = Math.max(this.minAnimationMilliseconds, t);
    item._rt_animDuration = Math.min(this.maxAnimationMilliseconds, t);
  }

  var u = (now - item._rt_animStartTime)/item._rt_animDuration;
  if (u > 1.0) {
    u = 1.0;
  }

  // Move the item.
  var x = u*item._rt_anim_m + item._rt_anim_b;
  item._rt_currX = x;
  item._rt_currCtrX = x + item._rt_halfWidth;
  item._rt_element.style.left = x + "px";

  if (u < 1.0) {
    // Continue animating.
    this._requestFrame(item);
  } else {
    // Stop animating.
    item._rt_isAnimating = false;
    //console.log("animation done for "+item.getID());
  }
};

RankingTask.prototype._startDrag = function(item, pointerX) {

  if (item._rt_isBeingDragged) {
    return;
  }

  item._rt_isBeingDragged = true;

  // Stop the item's animation (if any).
  this._stopAnimation(item);

  // Bring to front.
  item._rt_element.style.zIndex = this._nextZIndex;
  this._nextZIndex += 1;

  // The drag offset includes both the pointer offset and the correction needed
  //  to convert the viewport coordinate to the container (itemsDiv) coordinate.
  var itemBB = item._rt_element.getBoundingClientRect();
  var itemsBB = this._itemsDiv.getBoundingClientRect();
  item._rt_dragOffsetX = pointerX - itemBB.left + itemsBB.left;
  item._rt_dragMinX = this._itemsMinX;
  item._rt_dragMaxX = this._itemsMaxX - itemBB.width;
};

RankingTask.prototype._updateDrag = function(item, pointerX) {

  // Determine the item's new drag position and move it.
  var x = pointerX - item._rt_dragOffsetX;
  if (x < item._rt_dragMinX) {
    x = item._rt_dragMinX;
  } else if (x > item._rt_dragMaxX) {
    x = item._rt_dragMaxX;
  }
  item._rt_currX = x;
  item._rt_currCtrX = x + item._rt_halfWidth;
  item._rt_element.style.left = x + "px";

  //console.log("updateDrag for "+item.getID()+", "+x);

  // Move the other items if necessary.
  this._updateFromScreen();
};

RankingTask.prototype._stopDrag = function(item) {
  if (!item._rt_isBeingDragged) {
    return;
  }
  item._rt_isBeingDragged = false; 
  this._updateFromScreen();

  // todo: revisit
  this._startAnimation(item);
};

RankingTask.prototype._updateFromScreen = function() {
  // This function updates the answer order (the order of the _items array) based on
  //  the items' current screen positions (_rt_currCtrX properties).
  // If an item's index in the answer array has changed it will be moved to the corresponding
  //  screen position (_rt_restX is recalculated) using an animation.
  
  // Save the pre-update answer order.
  for (var i = 0; i < this._items.length; ++i) {
    this._items[i]._rt_prevIndex = i;
  }

  // Sort the items according to their current screen positions.
  this._items.sort(function(a, b) {
    return a._rt_currCtrX - b._rt_currCtrX;
  });

  this._calcRestPositions();

  // For each item(*) whose answer order has changed, start or extend an animation
  //  to the final position. (* excluding items being dragged) 
  for (var i = 0; i < this._items.length; ++i) {
    var item = this._items[i];
    //console.log(item.getID()+", "+i+", "+item._rt_index);
    if (item._rt_isBeingDragged) {
      continue;
    }
    if (item._rt_prevIndex != i) {
      // The item has changed position.
      this._startAnimation(item);
    }
  }
};


/*
 *  RTImageItem
 */

function RTImageItem(parent, id, src) {
  this._parent = parent;
  this._id = id;

  this._element = document.createElement("div");
  this._element.className = "rt-item-div";
   
  this._img = document.createElement("img");

  var item = this;
  this._onLoadProxy = function(e) {
    item._onLoad(e);
  };

  this._img.addEventListener("load", this._onLoadProxy);
  this._img.className = "rt-item-img";
  this._img.src = src;

  this._element.appendChild(this._img);
}

RTImageItem.prototype._onLoad = function(e) {
  this._img.removeEventListener("load", this._onLoadProxy);
  this._rawWidth = this._img.width;
  this._rawHeight = this._img.height;
  this._parent._itemIsReady(this);
};

RTImageItem.prototype.getRawSize = function() {
  return {width: this._rawWidth, height: this._rawHeight};
};

RTImageItem.prototype.getID = function() {
  return this._id;
};

RTImageItem.prototype.getElement = function() {
  return this._element;
};




