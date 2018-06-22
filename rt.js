/*
 * Ranking Task Widget - JavaScript
 * astro.unl.edu
 * v0.0.1 (in active development)
 * 22 June 2018
*/


/*
 *  RankingTask
 */

function RankingTask(rootElement) {

  while (rootElement.firstChild) {
    rootElement.removeChild(rootElement.firstChild);
  }
  this._rootElement = rootElement;

  this.dragMarginIncursion = 0.75;

  this._question = document.createElement("p");
  this._question.className = "rt-question-p";
  this._rootElement.appendChild(this._question);
  
  this._itemsDiv = document.createElement("div");
  this._itemsDiv.className = "rt-items-div";
  this._rootElement.appendChild(this._itemsDiv);
}

RankingTask.prototype.initWithXML = function(xmlURL) {

//  console.log("initWithXML, url: "+xmlURL);
//  var r = this._rootElement.getBoundingClientRect();
//console.log(r);

//  this._itemsContainer = document.createElement("div");
//  this._itemsContainer.style.margin = "0";
//  this._itemsContainer.style.backgroundColor = "lightRed";
//  this._rootElement.appendChild(this._itemsContainer);

//this._maxItemHeight = window.innerHeight - this._itemsContainer.offsetTop;
  
  
  this._question.textContent = "Rank the coins by increasing value. This is a longer sentence in order to achieve wrap-around. The previous sentence may not be long enough, so this sentence has been added.";

  var images = ["demo/penny.png", "demo/nickel.png", "demo/dime.png", "demo/quarter.png"];
  
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
  this._itemsDiv.appendChild(element);
  
  this._itemsCountdown -= 1;
  if (this._itemsCountdown == 0) {
    // All items ready.
   
    this._recalculateScale();
    
    // Make items visible.
    for (var i = 0; i < this._items.length; ++i) {
      var element = this._items[i].getElement();
      element.style.display = "block";
    }

    this._resetItemLayout();
  }
};

RankingTask.prototype._recalculateScale = function() {
  // todo: skip if fundamentals have not changed, or call only on relevant change events

  // Review the unscaled sizes of the items.
  var widthSum = 0.0;
  var maxHeight = 0.0;
  for (var i = 0; i < this._items.length; ++i) {
    var item = this._items[i];
    var size = item.getRawSize();
    widthSum += size.width;
    if (size.height > maxHeight) maxHeight = size.height;
  }

  // Calculate the max scale such that all items fit vertically.
  var itemsBB = this._itemsDiv.getBoundingClientRect();
  var maxHeightScale = 1.0;
  if (itemsBB.height > 0.0) {
    var maxHeightScale = Math.min(itemsBB.height/maxHeight, 1.0);
  }

  // Calculate the max scale such that all items fit horizontally.
  var rootBB = this._rootElement.getBoundingClientRect();
  this._margin = itemsBB.x - rootBB.x;
  var widthAvailable = itemsBB.width - this._margin*(this._items.length - 1);
  var maxWidthScale = widthAvailable/widthSum; 
  
  // Determine the scale to use and apply it to all items.
  var scale = Math.min(maxHeightScale, maxWidthScale);
  widthSum = 0.0;
  for (var i = 0; i < this._items.length; ++i) {
    var item = this._items[i];
    var element = item.getElement();
    var size = item.getRawSize();
    var w = scale*size.width;
    element.style.width = w + "px";
    element.style.height = scale*size.height + "px";
    widthSum += w;
  }
  widthSum += this._margin*(this._items.length - 1);
  this._itemsStartX = (itemsBB.width - widthSum)/2.0;
  this._itemsMidlineY = itemsBB.y + (itemsBB.height/2.0);
  this._itemsMinX = itemsBB.x - this.dragMarginIncursion*this._margin;
  this._itemsMaxX = itemsBB.x + itemsBB.width + this.dragMarginIncursion*this._margin;

//  console.log("itemsStartX: "+this._itemsStartX);
//  console.log("itemsMidlineY: "+this._itemsMidlineY);
//  console.log("itemsMinX: " + this._itemsMinX);
//  console.log("itemsMaxX: " + this._itemsMaxX);
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
//  console.log(" itemBB.x: "+itemBB.x);
//  console.log(" mouse: "+e.clientX+", "+e.clientY);

  element.style.zIndex = this._nextZIndex;
  this._nextZIndex += 1;

  this._dragItem = item;
  this._dragInitMouseX = e.clientX;
  this._dragInitX = itemBB.x;
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




