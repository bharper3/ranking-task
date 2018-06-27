/*
 * Ranking Task Widget - JavaScript
 * astro.unl.edu
 * v0.0.2 (in active development)
 * 25 June 2018
*/

console.log("rt.js is executing");


/*
 *  RankingTask
 */

function RankingTask(rootElement, prefixKludge) {

  this._prefix = prefixKludge; // todo: remove

  // todo: verify rootElement is a div with correct class, and log meaningful
  //  error if it is not

  while (rootElement.firstChild) {
    rootElement.removeChild(rootElement.firstChild);
  }
  this._rootElement = rootElement;

  // _heightIsRestricted determines whether to limit the height of content.
  this._heightIsRestricted = (this._rootElement.clientHeight > 0);

  // dragMarginIncursion -- defines the drag limits of an item as a fraction of
  //  the margin around the items' area (rt-items-div)
  this.dragMarginIncursion = 0.75;

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

  var id = this._rootElement.id;

  var s = new ResizeSensor(this._itemsDiv, function() {
    console.log("items div has resized, "+id);
  });
}

RankingTask.prototype.initWithXML = function(xmlURL) {

  this._question.textContent = "Rank the coins by increasing value. This is a longer sentence in order to achieve wrap-around. The previous sentence may not be long enough, so this sentence has been added.";

  var images = [this._prefix+"penny.png", this._prefix+"nickel.png", this._prefix+"dime.png", this._prefix+"quarter.png"];
 
  this._items = [];
  this._itemsCountdown = images.length;

  for (var i = 0; i < images.length; ++i) {
    var src = images[i];
    var item = new RTImageItem(this, src, src);
    this._items.push(item);
  }
};

RankingTask.prototype._itemIsReady = function(item) {

  // Add item's element, but keep it hidden until after first layout.
  var element = item.getElement();
  element.style.display = "none";

  var itemWrapper = document.createElement("div");
  itemWrapper.className = "rt-item-div";
  itemWrapper.appendChild(element);
  this._itemsDiv.appendChild(itemWrapper);
  
  this._itemsCountdown -= 1;
  if (this._itemsCountdown == 0) {
    // All items ready.
   
    //this._recalculateScale();
    
    // Make items visible.
    for (var i = 0; i < this._items.length; ++i) {
      var element = this._items[i].getElement();
      element.style.display = "block";
    }

    //this._resetItemLayout();
  }
};

RankingTask.prototype._recalculateScale = function() {
  // todo: skip if fundamentals have not changed, or call only on relevant change events

  var qBB = this._question.getBoundingClientRect();
  console.log("qBB...");
  console.log(qBB);

  var innerBB = this._innerDiv.getBoundingClientRect();
  console.log("innerBB...");
  console.log(innerBB);

  this._margin = qBB.left - innerBB.left;

  //this._itemsDiv.style.left = this._margin + "px";
  //this._itemsDiv.style.top = this._margin + "px";
  //this._itemsDiv.style.width = qBB.width + "px";
 
  // When height is restricted the height of itemsDiv and innerDiv is deteremined later, after
  //  inspecting all the items.
  if (this._heightIsRestricted) {
    this._itemsDiv.style.height = (innerBB.height - 3*this._margin - qBB.height) + "px";
  }

  var itemsBB = this._itemsDiv.getBoundingClientRect();
  console.log("itemsBB...");
  console.log(itemsBB);


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

  console.log("max image height: "+maxHeight);

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
    var element = item.getElement();
    var size = item.getRawSize();
    var w = scale*size.width;
    element.style.width = w + "px";
    var h =  scale*size.height;
    element.style.height = h + "px";
    widthSum += w;
    if (h > maxHeight) maxHeight = h;
  }
  widthSum += this._margin*(this._items.length - 1);
  this._itemsStartX = (itemsBB.width - widthSum)/2.0;
  this._itemsMidlineY = (itemsBB.height/2.0);
  this._itemsMinX = itemsBB.left - this.dragMarginIncursion*this._margin;
  this._itemsMaxX = itemsBB.left + itemsBB.width + this.dragMarginIncursion*this._margin;

  if (!this._heightIsRestricted) {
    this._itemsDiv.style.height = maxHeight + "px";
    this._itemsMidlineY = maxHeight/2.0;
  }

  console.log("itemsStartX: "+this._itemsStartX);
  console.log("itemsMidlineY: "+this._itemsMidlineY);
  console.log("itemsMinX: " + this._itemsMinX);
  console.log("itemsMaxX: " + this._itemsMaxX);
};

RankingTask.prototype._resetItemLayout = function() {
  var x = this._itemsStartX;
  for (var i = 0; i < this._items.length; ++i) {
    var item = this._items[i];
    var element = item.getElement();
    var bb = element.getBoundingClientRect();
    var y = this._itemsMidlineY - (bb.height/2.0);
    element.style.left = x + "px";
    element.style.top = y + "px";
//    console.log(item.getID());
//    console.log(bb);
//    console.log(" x: "+x);
//    console.log(" y: "+y);
    x += bb.width + this._margin;
    element.style.zIndex = i;
  }
  this._nextZIndex = this._items.length;
};
    
RankingTask.prototype._dragStart = function(e, item) {
//  console.log("mousedown, "+item.getID());
  var element = item.getElement();
  var itemBB = element.getBoundingClientRect();
//  console.log(" itemBB.left: "+itemBB.left);
//  console.log(" mouse: "+e.clientX+", "+e.clientY);

  element.style.zIndex = this._nextZIndex;
  this._nextZIndex += 1;

  this._dragItem = item;
  this._dragInitMouseX = e.clientX;
  this._dragInitX = itemBB.left;
  this._dragMinX = this._itemsMinX;
  this._dragMaxX = this._itemsMaxX - itemBB.width;

  var rt = this;

  function onMouseMoveProxy(e) {
    rt._dragUpdate(e);
    e.preventDefault();
  }

  function onMouseUpOrOutProxy(e) {
    console.log(e);
    rt._dragStop(e);
    document.removeEventListener("mousemove", onMouseMoveProxy);
    document.removeEventListener("mouseup", onMouseUpOrOutProxy);
    document.removeEventListener("mouseleave", onMouseUpOrOutProxy);
    e.preventDefault();
  }

  document.addEventListener("mousemove", onMouseMoveProxy);
  document.addEventListener("mouseup", onMouseUpOrOutProxy);
  document.addEventListener("mouseleave", onMouseUpOrOutProxy);
  
};

RankingTask.prototype._dragUpdate = function(e) {
//  console.log("onMouseMove");
  var element = this._dragItem.getElement();

  var x = this._dragInitX + e.clientX - this._dragInitMouseX;
  if (x < this._dragMinX) {
    x = this._dragMinX;
  } else if (x > this._dragMaxX) {
    x = this._dragMaxX;
  }

  element.style.left = x + "px";
};

RankingTask.prototype._dragStop = function(e) {
//  console.log("onMouseUp");

  var element = this._dragItem.getElement();
};


/*
 *  RTImageItem
 */

function RTImageItem(parent, id, src) {
  this._parent = parent;
  this._id = id;
  this._img = document.createElement("img");
  var item = this;
  this._img.addEventListener("load", function(e) {item._onLoad(e);});
  this._img.className = "rt-item-img";
  this._img.src = src;
}

RTImageItem.prototype._onLoad = function(e) {
  this._rawWidth = this._img.width;
  this._rawHeight = this._img.height;
  var parent = this._parent;
  var item = this;
  function onMouseDownProxy(e) {
    parent._dragStart(e, item);
    e.preventDefault();
  }
  this._img.addEventListener("mousedown", onMouseDownProxy);
  this._parent._itemIsReady(this);
};

RTImageItem.prototype.getRawSize = function() {
  return {width: this._rawWidth, height: this._rawHeight};
};

RTImageItem.prototype.getID = function() {
  return this._id;
};

RTImageItem.prototype.getElement = function() {
  return this._img;
};




