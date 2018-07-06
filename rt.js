/*
 * Ranking Task Widget - JavaScript
 * astro.unl.edu
 * v0.0.10 (in active development)
 * 5 July 2018
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
  this._htmlID = this._rootElement.id;

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


  this._footer = document.createElement("div");
  this._footer.className = "rt-footer";
  this._innerDiv.appendChild(this._footer);


  var footerLeft = document.createElement("div");
  footerLeft.className = "rt-footer-left";
  this._footer.appendChild(footerLeft);

  var footerCenter = document.createElement("div");
  footerCenter.className = "rt-footer-center";
  this._footer.appendChild(footerCenter);

  var footerRight = document.createElement("div");
  footerRight.className = "rt-footer-right";
  this._footer.appendChild(footerRight);

  this._feedback = document.createElement("div");
  this._feedback.textContent = ".";
  this._feedback.className = "rt-feedback";

  this._gradeButton = document.createElement("button");
  this._gradeButton.className = "rt-grade-button";
  this._gradeButton.type = "button";
  this._gradeButton.name = "grade";
  this._gradeButton.textContent = "Grade";
  footerRight.appendChild(this._gradeButton);

  footerCenter.appendChild(this._feedback);

  this._backgroundButton = document.createElement("button");
  this._backgroundButton.className = "rt-background-button";
  this._backgroundButton.type = "button";
  this._backgroundButton.name = "background";
  this._backgroundButton.textContent = "Background";
  footerLeft.appendChild(this._backgroundButton);
  
  var rt = this;

  this._gradeButton.addEventListener("click", function(e) {
    rt._onGradeButtonClick();
  });

  this._backgroundButton.addEventListener("click", function(e) {
    rt._openBackground();
  });

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


RankingTask.prototype._openBackground = function() {
  if (this._backgroundSrc !== null) {
    window.open(this._backgroundSrc, this._htmlID+"0");
  } else {
    console.error("openBackground called without a valid source defined.");
  }
};

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
  
  var numToSelectArr = rtXML.getElementsByTagName("numToSelect");
  if (numToSelectArr.length > 0) {
    obj.numToSelect = numToSelectArr[0].childNodes[0].nodeValue;
  }

  var backgroundArr = rtXML.getElementsByTagName("background");
  if (backgroundArr.length > 0) {
    var srcArr = backgroundArr[0].getElementsByTagName("src");
    if (srcArr.length > 0) {
      obj.background = {src: srcArr[0].childNodes[0].nodeValue};
    } 
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

RankingTask.prototype._reset = function(obj, baseURL) {

  this._isReady = false;
  this._removeChildren(this._itemsDiv);

  if (typeof baseURL !== "string" || baseURL == "") {
    baseURL = null;
  }

  this._question.textContent = obj.question;

  // Randomize the order of items (the complete list).
  var shuffledItems = this._shuffle(obj.items);
  
  // Select a subset of items, if specified.
  var numToSelect = parseInt(obj.numToSelect);
  if (Number.isNaN(numToSelect) || numToSelect < 2 || numToSelect > shuffledItems.length) {
    // todo: warn if numToSelect is defined but not valid
    numToSelect = shuffledItems.length;
  }
  var selectedItems = shuffledItems.slice(0, numToSelect);

  var allowGrading = true;

  // Create and load the selected items.
  this._itemsCountdown = selectedItems.length;
  this._items = [];
  for (var i = 0; i < this._itemsCountdown; ++i) {
    var itemObj = selectedItems[i];
    var itemID = (itemObj.id !== undefined) ? itemObj.id : ""; 

    var context = "rankingTask ID: " + obj.id + ", item ID: " + itemID;

    var itemValue = parseFloat(itemObj.value);
    if (allowGrading && Number.isNaN(itemValue)) {
      allowGrading = false;
      this._reportWarning(context, "Grading is not possible since an item does not have a valid value.");
    }
    
    if (itemObj.type == "image") {
      if (itemObj.src === undefined) {
        this._reportException(context, "An image item is missing the required src property.");
        return;
      } 
      var item;
      if (baseURL !== null) {
        const urlObj = new URL(itemObj.src, baseURL);
        item = new RTImageItem(this, itemID, urlObj.toString());
      } else {
        item = new RTImageItem(this, itemID, itemObj.src);
      }
      item._rt_value = itemValue;
      item._rt_isAnimating = false;
      item._rt_isBeingDragged = false;
      this._items.push(item);
    } else {
      this._reportException(context+", type: \""+itemObj.type+"\"", "An item has an invalid type property.");
      return;
    }
  }

  var enableBackgroundPage = true;

  if (enableBackgroundPage && obj.background !== undefined && obj.background.src !== undefined) {
    // Enable background page option.
    this._backgroundButton.style.display = "block";
    if (baseURL !== null) {
      const urlObj = new URL(obj.background.src, baseURL);
      this._backgroundSrc = urlObj.toString();
    } else {
      this._backgroundSrc = obj.background.src;
    }
  } else {
     // No background page option.
    this._backgroundButton.style.display = "none";
    this._backgroundSrc = null;
  }

  this._gradeButton.textContent = "Grade";
  if (allowGrading) {
    this._gradeButton.disabled = false;
  } else {
    this._gradeButton.disabled = true;
  }

  this._feedback.textContent = " ";

  this._answerMode = false;
};

RankingTask.prototype._onGradeButtonClick = function() {
  if (this._answerMode) {
    this._reset(this._resetObj, this._resetBaseURL);
  } else {
    this._cancelAllDragging();
    this._grade();
    this._gradeButton.textContent = "Reset";
    this._gradeButton.name = "reset";
    this._gradeButton.disabled = false;  
  }
};

RankingTask.prototype._grade = function() {
  // todo: revise structure
  console.log("grade");
  this._answerMode = true;

  // todo: make more helpful

  var prevValue = this._items[0]._rt_value;
  for (var i = 1; i < this._items.length; ++i) {
    if (prevValue > this._items[i]._rt_value) {
      this._feedback.textContent = "Incorrect!";
      return;
    }
    prevValue = this._items[i]._rt_value;
  }

  this._feedback.textContent = "Correct!";  
};

RankingTask.prototype.initWithObject = function(obj, baseURL) {
  // Initializes the ranking task with a JavaScript object.
  // The baseURL is used to expand relative resource urls (e.g. an image's source).
  //  Pass an empty string for baseURL to skip this step (i.e. leave it up to the browser).
  // The object is expected to have these properties:
  //   id
  //   question
  //   items (an array)
  //   numToSelect (optional)
  // Each item is expected to have
  //   id (optional) - uniquely identifies the item within the items list
  //   type - valid options: "image"
  //   value (optional) - a number
  // If type is image then the item is expected to have
  //   src - the url for the image
 
  this._resetObj = Object.assign({}, obj);
  this._resetBaseURL = baseURL;

  // todo: revise reset mechanism
  this._reset(this._resetObj, this._resetBaseURL);

};

RankingTask.prototype._reportWarning = function(context, message) {
  console.warn("RankingTask, html ID: "+this._htmlID+", "+context+", "+message);
};

RankingTask.prototype._reportException = function(message) {
  console.error("RankingTask, html ID: "+this._htmlID+", "+context+", "+message);
  this._removeChildren(this._itemsDiv);
  this._question.textContent = message;
  // todo: revise structure 
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

  // Add functions and properties to the item for dragging.
  var rt = this;

  // Mouse event handlers.
  item._rt_onMouseMoveProxy = function(e) {
    rt._updateDrag(item, e.clientX);
    e.preventDefault();
  };
  item._rt_onMouseFinishedProxy = function(e) {
    rt._stopDrag(item);
    e.preventDefault();
  };
  item._rt_onMouseDownProxy = function(e) {
    var bb = item._rt_element.getBoundingClientRect();
    var offsetX = e.clientX - bb.left - item._rt_halfWidth;
    var didStart = rt._startDrag(item, offsetX);
    if (didStart) {
      item._rt_isBeingMouseDragged = true;
      document.addEventListener("mousemove", item._rt_onMouseMoveProxy);
      document.addEventListener("mouseup", item._rt_onMouseFinishedProxy);
      document.addEventListener("mouseleave", item._rt_onMouseFinishedProxy);
      e.preventDefault();
    }
  };
  item._rt_element.addEventListener("mousedown", item._rt_onMouseDownProxy);

  // Touch event handlers.
  item._rt_onTouchMoveProxy = function(e) {
    item._rt_trackAnyBackupTouches(e.changedTouches);
    var touch = item._rt_getActiveTouch(e);
    if (touch === null) {
      return;
    }
    rt._updateDrag(item, touch.clientX);
    e.preventDefault();
  };
  item._rt_onTouchFinishedProxy = function(e) {
    item._rt_stopTrackingAnyBackupTouches(e.changedTouches);
    var touch = item._rt_getActiveTouch(e);
    if (touch === null) {
      return;
    }
    // The currently active touch has ended, so check if there is a
    //  suitable backup touch.
    var backup = item._rt_selectBackupTouch();
    if (backup !== null) {
      // Switch to the backup touch.
      item._rt_touchID = backup.id; 
      rt._resetDrag(item, backup.x - item._rt_currCtrX);
    } else {
      // There is no backup touch, so stop dragging.
      rt._stopDrag(item);
    }
  };
  item._rt_getActiveTouch = function(e) {
    // A helper function to get the Touch object in e.changedTouches that is
    //  the active touch for this item, or null.
    if (this._rt_touchID === null) {
      console.error("getTouch called for item with no active touch (event: "+e.type+").");
      return null;
    }
    for (var i = 0; i < e.changedTouches.length; ++i) {
      var touch = e.changedTouches[i];
      if (touch.identifier === item._rt_touchID) {
        return touch;
      }
    }
    return null;
  };

  // Backup touches stuff.
  item._rt_startTrackingBackupTouches = function(touches) {
    // This function starts tracking all of the given Touch objects as backup touches.
    var itemsBB = rt._itemsDiv.getBoundingClientRect();
    var cx = itemsBB.left;
    var cy = itemsBB.top;
    for (var i = 0; i < touches.length; ++i) {
      var touch = touches[i];
      this._rt_backupTouches.push({id: touch.identifier, x: touch.clientX - cx, y: touch.clientY - cy});
    } 
  };
  item._rt_trackAnyBackupTouches = function(touches) {
    // This function updates the positions of any backup touches that are in the
    //  given array of Touch objects.
    // For all backup touches...
    var cx, cy;
    for (var i = 0; i < this._rt_backupTouches.length; ++i) {
      var backup = this._rt_backupTouches[i];
       // ...check all of the given Touch objects to see if it is included.
      for (var j = 0; j < touches.length; ++j) {
        // If the touch is included...
        var touch = touches[j];
        if (touch.identifier === backup.id) {
          // ...track it.
          if (cx === undefined) {
            var itemsBB = rt._itemsDiv.getBoundingClientRect();
            cx = itemsBB.left;
            cy = itemsBB.top;
          }
          backup.x = touch.clientX - cx;
          backup.y = touch.clientY - cy;
          break;
        }
      }
    }
  };
  item._rt_stopTrackingAnyBackupTouches = function(touches) {
    // If any of the given Touch objects are being tracked as backup
    //  touches they will be removed from the backups array.
    for (var i = this._rt_backupTouches.length - 1; i >= 0; --i) {
      var id = this._rt_backupTouches[i].id;
      for (var j = 0; j < touches.length; ++j) {
        if (touches[j].identifier === id) {
          this._rt_backupTouches.splice(i, 1);
          break;
        }
      }
    }
  };
  item._rt_selectBackupTouch = function() {
    // This function searches the backup touches list to find the nearest
    //  touch that is within the item's 'umbra' (bounding box plus a margin).
    // If such a touch exists it is removed from the backup touches list
    //  and is returned as an object with id, x, and y properties (x and y are
    //  the touch's latest tracked coordinates in the itemsDiv container).
    // If there is no such touch then the function returns null.
    var marginFactor = 1.1;
    var maxX = marginFactor*this._rt_halfWidth;
    var minX = -maxX;
    var maxY = marginFactor*this._rt_halfHeight;
    var minY = -maxY;
    var selR2 = Number.POSITIVE_INFINITY;
    var selIndex = -1;
    var selTouch = null;
    for (var i = 0; i < this._rt_backupTouches.length; ++i) {
      var touch = this._rt_backupTouches[i];
      var x = touch.x - this._rt_currCtrX;
      var y = touch.y - this._rt_currCtrY;
      if (x < minX || x > maxX || y < minY || y > maxY) {
        continue;
      }
      var r2 = x*x + y*y;
      if (r2 < selR2) {
        selR2 = r2;
        selIndex = i;
        selTouch = touch;
      }
    }
    if (selIndex >= 0) {
      // Remove the selected touch from the backups array.
      this._rt_backupTouches.splice(selIndex, 1);
    }
    return selTouch;
  };
 
  item._rt_onTouchStartProxy = function(e) {
    // This event handler is called when a touch starts on the item.
    // Reminder: multiple touches may start simultaneously, and additional
    //  touches may start while the item is being dragged.
    // The first 'active' touch is the one that will control the item's
    //  position until it ends, at which point a backup touch may take
    //  over as the active touch to continue dragging.
    
    // If there is currently no active touch then clear the backups array.
    if (item._rt_touchID === null) {
      item._rt_backupTouches = [];
    } 

    // Start by making all the new touches backup touches.
    item._rt_startTrackingBackupTouches(e.changedTouches);

    // If there is already an active touch then return.
    if (item._rt_touchID !== null) {
      e.preventDefault();
      return;
    }

    // Since there is no active touch select one from the backups array.
    // touch will be an object with id, x, and y properties.
    var touch = item._rt_selectBackupTouch();
    if (touch === null) {
      // This is unexpected -- this event handler was called because there are
      //  new touches on the item, therefore there should be at least one
      //  suitable touch in the backups array.
      // Fallback: report the error, select the first new touch as the active one,
      //  and make any remaining touches the backups.
      console.error("Unexpected failure to select an active touch for item \'"+item._rt_name+"\'.");
      var touch = {};
      touch.id = e.changedTouches[0].identifier;
      var itemsBB = rt._itemsDiv.getBoundingClientRect();
      touch.x = e.changedTouches[0].clientX - itemsBB.left;
      // NB: don't need touch.y for startDrag.
      item._rt_backupTouches  = [];
      var backups = Array.from(e.changedTouches).slice(1);
      item._rt_startTrackingBackupTouches(backups);
    }

    // Attempt to start dragging.
    var didStart = rt._startDrag(item, touch.x - item._rt_currCtrX);
    if (didStart) {
      item._rt_touchID = touch.id;
      document.addEventListener("touchmove", item._rt_onTouchMoveProxy);
      document.addEventListener("touchend", item._rt_onTouchFinishedProxy);
      document.addEventListener("touchcancel", item._rt_onTouchFinishedProxy);
      e.preventDefault();
    }
  };
  item._rt_element.addEventListener("touchstart", item._rt_onTouchStartProxy);

  // Combined touch and mouse dragging stuff.
  item._rt_removeDragListeners = function() {
    // Called by the ranking task's stopDrag function.
    // This logic has been separated from the event handlers (onMouseFinishedProxy and
    //  onTouchFinishedProxy) since dragging may be stopped for other reasons (e.g. the
    //  question was graded during dragging).
    if (this._rt_isBeingMouseDragged) {
      this._rt_isBeingMouseDragged = false;
      document.removeEventListener("mousemove", this._rt_onMouseMoveProxy);
      document.removeEventListener("mouseup", this._rt_onMouseFinishedProxy);
      document.removeEventListener("mouseleave", this._rt_onMouseFinishedProxy);
    }
    if (this._rt_touchID !== null) {
      this._rt_touchID = null;
      document.removeEventListener("touchmove", this._rt_onTouchMoveProxy);
      document.removeEventListener("touchend", this._rt_onTouchFinishedProxy);
      document.removeEventListener("touchcancel", this._rt_onTouchFinishedProxy);
    }
  };
  
  // This flag is necessary for removeDragListeners.
  item._rt_isBeingMouseDragged = false;

  // The touchID property is used to track the current active touch (the touch that controls
  //  the position of the item).
  item._rt_touchID = null;

  // The backupTouches array is used to track touches that have started on the item
  //  after the active touch started. When the active touch ends one of these backups may be
  //  selected to replace it, depending on how close they are to the item at that time.
  // Each item in this array is an object with id, x, and y properties. x and y track the
  //  most recent position of the touch in the itemsDiv container.
  item._rt_backupTouches = [];

  // Check if all the items are ready. 
  this._itemsCountdown -= 1;
  if (this._itemsCountdown == 0) {
    
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
  var footerBB = this._footer.getBoundingClientRect();
  var innerBB = this._innerDiv.getBoundingClientRect();

  this._margin = questionBB.left - innerBB.left;
  
  // When height is unrestricted the height of itemsDiv is determined later, after
  //  inspecting all the items.
  if (this._heightIsRestricted) {
    this._itemsDiv.style.height = (innerBB.height - 4*this._margin - questionBB.height - footerBB.height) + "px";
  }

  var itemsBB = this._itemsDiv.getBoundingClientRect();

  // Review the unscaled sizes of the items.
  var widthSum = 0.0;
  var minWidth = Number.POSITIVE_INFINITY;
  var maxWidth = 0.0;
  var maxHeight = 0.0;
  for (var i = 0; i < this._items.length; ++i) {
    var item = this._items[i];
    var size = item.getRawSize();
    widthSum += size.width;
    if (size.width > maxWidth) {
      maxWidth = size.width;
    }
    if (size.width < minWidth) {
      minWidth = size.width;
    }
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
  // sideMargin is the total margin (left plus right) that guarantees that a larger
  //  item can be dragged past a smaller item at the ends.
  var sideMargin = 1.05*(maxWidth - minWidth);
  var widthAvailable = itemsBB.width - sideMargin - this._margin*(this._items.length - 1);
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
    item._rt_halfHeight = h/2.0;
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
    item._rt_currCtrY = this._itemsMidlineY;
    item._rt_currY = y;
  }
  this._nextZIndex = this._items.length;

};

RankingTask.prototype._cancelAllDragging = function() {
  for (var i = 0; i < this._items.length; ++i) {
    var item = this._items[i];
    this._stopDrag(item);
  }
};

RankingTask.prototype._snapItemsToRest = function() {
  // This function will snap all items to their final rest positions (_rt_restX),
  //  cancelling all active animations and dragging.
  for (var i = 0; i < this._items.length; ++i) {
    var item = this._items[i];
    this._stopAnimation(item);
    this._stopDrag(item);
    item._rt_currX = item._rt_restX;
    item._rt_currCtrX = item._rt_restX + item._rt_halfWidth;
    item._rt_element.style.left = item._rt_restX + "px";
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

RankingTask.prototype._startDrag = function(item, offsetX) {
  // Attempts to start dragging the item with the given x offset
  //  for the pointer (relative to the item's center).
  // Returns a bool indicating whether dragging was started.

  if (this._answerMode || item._rt_isBeingDragged) {
    return false;
  }

  item._rt_isBeingDragged = true;

  // Stop the item's position animation (if any).
  this._stopAnimation(item);

  // Bring to front.
  item._rt_element.style.zIndex = this._nextZIndex;
  this._nextZIndex += 1;

  // Set drag parameters.
  this._resetDrag(item, offsetX);

  return true;
};

RankingTask.prototype._resetDrag = function(item, offsetX) {
  // This function resets the parameters for an item that is
  //  being dragged.
  // offsetX is the pointer's x position relative to the item's center.
  if (!item._rt_isBeingDragged) {
    console.error("resetDrag called for an item that is not being dragged.");
    return;
  } 
  var itemBB = item._rt_element.getBoundingClientRect();
  item._rt_dragOffsetX = offsetX;
  item._rt_dragMinX = this._itemsMinX;
  item._rt_dragMaxX = this._itemsMaxX - itemBB.width;
};

RankingTask.prototype._updateDrag = function(item, pointerX) {
  // Updates the position of the item being dragged given the
  //  pointer's client x position.
  
  if (!item._rt_isBeingDragged) {
    console.error("updateDrag called for an item that is not being dragged.");
    return;
  }

  // Determine the item's new drag position and move it.
  var itemsBB = this._itemsDiv.getBoundingClientRect();
  var x = pointerX - itemsBB.left - item._rt_dragOffsetX - item._rt_halfWidth;
  if (x < item._rt_dragMinX) {
    x = item._rt_dragMinX;
  } else if (x > item._rt_dragMaxX) {
    x = item._rt_dragMaxX;
  }
  item._rt_currX = x;
  item._rt_currCtrX = x + item._rt_halfWidth;
  item._rt_element.style.left = x + "px";

  // Move the other items if necessary.
  this._updateFromScreen();
};

RankingTask.prototype._stopDrag = function(item) {
  if (!item._rt_isBeingDragged) {
    return;
  }
  item._rt_isBeingDragged = false; 

  item._rt_removeDragListeners();

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


