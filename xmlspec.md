# Ranking Task XML Specification, v0.2 (5 July 2018)

(This is a very preliminary version -- expect breaking changes.)

(Changes are documented at the bottom.)

A ranking task is defined by a `rankingTask` node. There may be multiple ranking tasks defined in a single XML file.

Each ranking task node must have a unique `id` attribute. This attribute is used to select a specific ranking task from the XML file.

Example (partial):
```xml
<rankingTask id="usaCurrCoins">
...
</rankingTask>
```

The ranking task must have one `question` node that provides the text for the question, and one `items` node that contains all the items to be ranked.

Example (partial):
```xml
<rankingTask id="usaCurrCoins">
  <question>Rank the coins by increasing value.</question>
  <items>
  ...
  </items>
</rankingTask>
```
The items list must contain at least two `item` nodes. An `item` node has these properties:

| Property | Notes | Description |
| --- | --- | --- |
| id | attribute, optional | uniquely identifies an item (intended for future use) |
| type | required | must be "image" (additional types will be added in future) |
| src | required | location of the image file, relative to the XML file (absolute URLs also allowed) |
| value | optional | number used for grading the ranking task (grading is not possible unless all selected items have a valid value) |

Note: the order of the items in the items list does not matter -- it is their `value` properties that determine the order for grading.

The ranking task may have an optional `numToSelect` node with an integer value. If defined, this will instruct the ranking task component to select a random subset of items from the items list. Otherwise, all items will be selected.

The ranking task may also have an optional `background` node. If defined, this node must have one `src` node that provides the address of the background page (either absolute or relative to the XML file).

Example (full):
```xml
<rankingTask id="usaCurrCoins">
  <question>Rank the coins by increasing value.</question>
  <numToSelect>3</numToSelect>
  <background>
    <src>background.html</src>
  </background>
  <items>
    <item id="penny">
      <type>image</type>
      <src>penny.png</src>
      <value>1</value>
    </item>
    <item id="nickel">
      <type>image</type>
      <src>nickel.png</src>
      <value>5</value>
    </item>
    <item id="dime">
      <type>image</type>
      <src>dime.png</src>
      <value>10</value>
    </item>
    <item id="quarter">
      <type>image</type>
      <src>quarter.png</src>
      <value>25</value>
    </item>
  </items>
</rankingTask>
```

### Change History

##### v0.2 (5 July 2018)

* Added background tag.

