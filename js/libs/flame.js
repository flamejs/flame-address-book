








window.Flame = Ember.Object.create({});


// In IE7, Range is not defined, which Metamorph handles with a fallback
if (typeof Range !== "undefined") {
  // In IE9, Range is defined but createContextualFragment is not, which Metamorph doesn't handle
  // From http://stackoverflow.com/questions/5375616/extjs4-ie9-object-doesnt-support-property-or-method-createcontextualfragme
  if (typeof Range.prototype.createContextualFragment === "undefined") {
      Range.prototype.createContextualFragment = function(html) {
          var doc = this.startContainer.ownerDocument;
          var container = doc.createElement("div");
          container.innerHTML = html;
          var frag = doc.createDocumentFragment(), n;
          while ( (n = container.firstChild) ) {
              frag.appendChild(n);
          }
          return frag;
      };
  }
}

if (String.prototype.trim === undefined) {
    String.prototype.trim = function() {
        return jQuery.trim(this);
    };
}

//nicked from stack overflow http://stackoverflow.com/questions/985272/jquery-selecting-text-in-an-element-akin-to-highlighting-with-your-mouse
function selectText(element) {
    var doc = document;
    var text = doc.getElementById(element);
    var range = null;
    if (doc.body.createTextRange) {
        range = document.body.createTextRange();
        range.moveToElementText(text);
        range.select();
    } else if (window.getSelection) {
        var selection = window.getSelection();
        if (selection.setBaseAndExtent) {
            selection.setBaseAndExtent(text, 0, text, 1);
        } else {
            range = document.createRange();
            range.selectNodeContents(text);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
}

;
Ember.mixin(Array.prototype, {
    sum: function() {
        return this.reduce(function(sum, x) { return sum+x; }, 0);
    },

    isEqual: function(ary) {
        if (!ary) return false ;
        if (ary == this) return true;

        var loc = ary.get('length') ;
        if (loc != this.get('length')) return false ;

        while(--loc >= 0) {
            if (!Ember.isEqual(ary.objectAt(loc), this.objectAt(loc))) return false ;
        }
        return true ;
    },

    max: function() {
        return Math.max.apply(Math, this);
    },

    min: function() {
        return Math.min.apply(Math, this);
    },

    flatten: function() {
        return this.reduce(function(a, b) { return a.concat(b); }, []);
    }
});
// Cannot do reopen on Ember.Binding
Ember.mixin(Ember.Binding.prototype, {
    eq: function(testValue) {
        return this.transform(function(value, binding) {
            return ((Ember.typeOf(value) === 'string') && (value === testValue));
        });
    },

    // If value evaluates to true, return trueValue, otherwise falseValue
    transformTrueFalse: function(trueValue, falseValue) {
        return this.transform(function(value, binding) {
            return value ? trueValue : falseValue;
        });
    },

    //only return binding if target
    kindOf: function(klasses) {
        return this.transform(function(value, binding) {
            var object = (Ember.isArray(value) ? value.toArray()[0] : value);
            var klassArray = Ember.isArray(klasses) ? klasses : [klasses];
            var isKindOf = klassArray.some(function(k) {
                return object && object instanceof k;
            });
            if (isKindOf) {
                return object;
            } else {
                return null;
            }
        });
    },

    //returns true if obj equals binding value
    equals: function(obj) {
        return this.transform(function(value, binding) {
            return obj === value;
        });
    },

    isNull: function() {
        return this.transform(function(value, binding) {
            return value === null;
        });
    },

    hasPermission: function(key) {
        return this.transform(function(value, binding) {
            return (value && value.hasPermission && value.hasPermission(key));
        });
    }
});
// IE < 10 doesn't support -ms-user-select CSS property, so we need to use onselectstart event to stop the selection
if (Ember.$.browser.msie && Ember.$.browser.version < 10) {
    Ember.$(function() {
        Ember.$('body').on('selectstart', function(e) {
            if (['INPUT', 'TEXTAREA'].contains(e.target.tagName) || $(e.target).parents().andSelf().is('.is-selectable')) {
                return true;
            } else {
                return false;
            }
        });
    });
}

;
Ember.mixin(Flame, {
    image: function(imageUrl) {
        return (typeof FlameImageUrlPrefix === 'undefined' ? 'images/' : FlameImageUrlPrefix) + imageUrl;
    }
});

jQuery.fn.selectRange = function(start, end) {
    return this.each(function() {
        if (this.setSelectionRange) {
            this.focus();
            this.setSelectionRange(start, end);
        } else if (this.createTextRange) {
            var range = this.createTextRange();
            range.collapse(true);
            range.moveEnd('character', end);
            range.moveStart('character', start);
            range.select();
        }
    });
};

jQuery.fn.replaceClasses = function(newClasses) {
    this.removeAttr('class');
    if (newClasses) {
        this.attr('class', newClasses);
    }
    return this;
};

/*
  This stuff solves two recurring problems with bindings:
    1) you often need several bindings to the same controller,
    2) you may want to use bindings to 'configure' views nested deep in the hierarchy.

  One option would be to have one binding on the top level in the view definition, then
  bind to that in the child views, but that's also suboptimal because you need a lot of
  parentView.parentView... type paths which are not robust w.r.t. changes in the view
  hierarchy. So here's how to do it:

  fooView1: Flame.View.extend({
    controllerPath: 'MyApp.someController',
    fooAction: 'MyApp.createFoo',

    fooView2: Flame.View.extend({
      fooView3: Flame.View.extend({
        foobarBinding: '$controllerPath.someProperty'  // Binds to MyApp.someController.someProperty
      }),
      fooView4: Flame.ButtonView.extend({
        foobarBinding: '$controllerPath.anotherProperty',  // Binds to MyApp.someController.anotherProperty
        actionBinding: '^fooAction'  // Binds to parentView.parentView.fooAction
      })
    })
  })

  Put in a bit more formal way:

    $<propertyName>[.<path>] => looks up propertyName in parent view/s, uses its value to prefix
                                given path, and binds to the resulting path
    ^<propertyName>[.<path>] => looks up propertyName in parent view/s and uses the path to that
                                to prefix given path

  Another way to think of this is that $propertyName expands to the value of that property,
  whereas ^propertyName expands to the path to that property.

  Beware that the latter syntax only works when the property you're binding to has a value
  other than 'undefined' at the time when the views are created. However it does work if it's
  defined by a binding, even if the binding hasn't been synchronized yet.

  A note about implementation: This kind of bindings are bound in Flame._bindPrefixedBindings,
  which needs to be explicitly called from the init of all root views (views that don't have
  parents). I have tried to make this more automagic by overriding Ember.Binding.connect. While
  it's easy to detect prefixed bindings there, the basic problem is that parentView is not
  yet set at that point. One possible approach is to add the prefixed bindings to a queue
  in connect and then process them later. However, the obj in connect is not the same as
  the final view object, but instead some kind of intermediate object that is then presumably
  wrapped later (in the prototype chain I assume) to become the real thing. Trying to bind
  to the intermediate object later doesn't work, and I cannot figure out a way to work out
  the final object, given the intermediate one (might be impossible). Thus, we're currently
  stuck with this implementation (which works but might get slow - it has to go through all
  properties of all views).
*/



Ember.mixin(Ember.Binding.prototype, {
    connect: function(obj) {
        var m = this._from.match(/^(\^|\$)/);
        if (!m) {  // If not a prefixed binding, connect normally
            return this._super(obj);
        }
    }
});

Flame.reopen({
    // Bind our custom prefixed bindings. This method has to be explicitly called after creating a new child view.
    _bindPrefixedBindings: function(view) {
        for (var key in view) {
            if (key.match(/Binding$/)) {
                var binding = view[key];
                if (!(binding instanceof Ember.Binding)) {
                    throw 'Expected a Ember.Binding!';
                }

                var m = binding._from.match(/^(\^|\$)([^.]+)(.*)$/);
                if (m) {
                    var useValue = m[1] === '$';
                    var property = m[2];
                    var suffix = m[3];
                    var prefix;

                    if (useValue) {
                        prefix = this._lookupValueOfProperty(view, property);
                    } else {
                        prefix = this._lookupPathToProperty(view, property);
                    }
                    ember_assert("Property '%@' was not found!".fmt(property), !Ember.none(prefix));

                    var finalPath = prefix + suffix;
                    var newBinding = new Ember.Binding(binding._to, finalPath);
                    newBinding._transforms = binding._transforms;  // Steal possible transforms
                    newBinding.connect(view);
                }
            }
        }
    },

    _lookupValueOfProperty: function(view, propertyName) {
        var cur = view, value;

        while (value === undefined && value !== null && cur !== undefined && cur !== null) {
            value = cur.get(propertyName);
            cur = cur.get('parentView');
        }

        return value;
    },

    _lookupPathToProperty: function(view, propertyName) {
        var path = [propertyName, 'parentView'];
        var cur = view.get('parentView');
        // Sometimes there's a binding but it hasn't 'kicked in' yet, so also check explicitly for a binding
        var bindingPropertyName = propertyName + 'Binding';

        while (!Ember.none(cur)) {
            if (cur.hasOwnProperty(propertyName) ||
                cur.constructor.prototype.hasOwnProperty(propertyName) ||
                cur.get(bindingPropertyName)) {
                return path.reverse().join('.');
            }
            path.push('parentView');
            cur = cur.get('parentView');
        }

        return undefined;
    }
});

/*
  A proxy that views the source array as sorted by given sort key and updates the sort key if the
  order of the items in the proxied array is changed. You can use this proxy in combination with
  a list view or tree view - that way, the concern of how to persist the order of the items is
  separated from the view. (Another reason for the existence of this class is that directly using
  sorted arrays backed by sproutcore-datastore is a bit problematic in that updating the sort index
  for any item results in the entire array being emptied and then re-populated.) Usage:

    array = [{index: 4, name: 'foo'}, {index: 1, name: 'bar'}]
    sortedArray = Flame.SortingArrayProxy.create({sortKey: 'index', source: array})

  Now if you reorder the proxy (with removeAt+insertAt pair), the index property will be updated
  on each item. If new items are added to the source, they appear in the proxy array in the correct
  position, and removing an item in the source results in it being removed from the proxy array.
  Similarly, insertions and removals in the proxy are reflected in the source array.

  Note that we don't keep the indexes stricly sequential, we only care about their relative order
  (in other words, there may be gaps after removal). This is to prevent unnecessary datastore
  updates.

  (Why give the source as 'source', not 'content', as is customary? Because it seems that then would
  need to re-implement all methods needed for array proxying, whereas with this approach we can just
  let Ember.ArrayProxy do the heavy lifting (we set 'content' as the sorted array). Or maybe I just can't
  figure out how to do it easily... Note that ArrayProxy does not keep a copy of the proxied array,
  but instead proxies all method calls directly. Here we really need to have a sorted copy, because
  sorting obviously changes the item indexes, and rewriting all operations and observers on the fly
  sounds like too difficult to implement.)
 */

Flame.SortingArrayProxy = Ember.ArrayProxy.extend({
    sortKey: 'position',
    parent: null,
    _suppressObservers: false,

    init: function() {
        this._sourceDidChange();
        this._super();

        this.get('content').addArrayObserver(this, {
            willChange: '_contentArrayWillChange',
            didChange: '_contentArrayDidChange'
        });
    },

    // This is a hack go work around a weird problem... We need to initialize content to [], but if
    // we do that in init(), it will in some cases fire an observer in ArrayProxy *after* the runloop
    // ends, which causes very bad things to happen. Don't really know why that happens... Anyway
    // with this hack we can avoid firing any observers on the content property.
    content: function(key, value) {
        if (value !== undefined) {
            this.set('_content', value);
        }

        var content = this.get('_content');
        if (content === undefined) {
            this.set('_content', content = []);
        }
        return content;
    }.property(),

    // When moving an item, use this sequence of calls:
    //  * startMoving()
    //  * removeAt(...)
    //  * insertAt(...)
    //  * endMoving()
    // This way the source array is not modified at all, only the sort keys are updated in
    // endMoving. This is needed in case the source array is not be modifiable (as is the
    // case with arrays returned by sproutcore-datastore queries).
    startMoving: function() {
        this._suppressObservers = true;
    },

    endMoving: function() {
        this._suppressObservers = false;

        var content = this.get('content');
        var sortKey = this.get('sortKey');
        this._withObserversSuppressed(function() {
            content.forEach(function(item, i) {
                Ember.setPath(item, sortKey, i);
            });
        });
    },

    _sourceWillChange: function() {
        var source = this.get('source');
        if (source) {
            var self = this;
            source.forEach(function(item) {
                self._removeSortIndexObserverFor(item);
            });

            source.removeArrayObserver(this, {
                willChange: '_sourceArrayWillChange',
                didChange: '_sourceArrayDidChange'
            });
        }
    }.observesBefore('source'),

    _sourceDidChange: function() {
        var source = this.get('source');
        if (source) {
            var sourceCopy = source.slice();  // sort mutates the array, have to make a copy
            this._sort(sourceCopy);

            var content = this.get('content');
            content.replace(0, content.get('length'), sourceCopy);

            var self = this;
            content.forEach(function(item) {
                self._addSortIndexObserverAndRegisterForRemoval(item);
            });

            source.addArrayObserver(this, {
                willChange: '_sourceArrayWillChange',
                didChange: '_sourceArrayDidChange'
            });
        }
    }.observes('source'),

    _addSortIndexObserverAndRegisterForRemoval: function(item) {
        var sortKey = this.get('sortKey');
        // Unfortunately the data store triggers a property change for all properties in a couple of fairly common
        // situations (reloading, and setting child values), so we check if the sort key really changed, so
        // we don't do unnecessary work
        item.lastPosition = item.get(sortKey);
        var observer = function() { 
            this._indexChanged(item);
        };
        Ember.addObserver(item, sortKey, this, observer);

        // The challenge here is that to be able to remove an observer, we need the observer function, and
        // that is created dynamically, so we need to store it somewhere... easiest on the item itself.
        item[this.get('observerKey')] = observer;
    },

    // Removes the observer from the item
    _removeSortIndexObserverFor: function(item) {
        var observer = item[this.get('observerKey')];
        if (observer) {
            Ember.removeObserver(item, this.get('sortKey'), this, observer);
            delete item[this.get('observerKey')];
        }
    },

    _getObserverKey: function() {
        return '__observer_'+Ember.guidFor(this);
    }.property().cacheable(),

    // Observes changes on the sortKey for each item in the source array. When changes, we simply
    // replace the items in our content array with a newly sorted copy. This means that from the
    // point of view of whoever's using this proxy (and observing changes), all items get replaced.
    // We could write something more sophisticated and just remove/insert the moved item, but this
    // should be fine at least for now (changes originating from sortKey updates indicate changes
    // in the backend by some other user, which is rare).
    _indexChanged: function(contentItem) {
        // Don't do anything if sort index didnt change
        if (contentItem.lastPosition === contentItem.get(this.get('sortKey')) || this._suppressObservers) return;  // Originating from us?
        this._sortAndReplaceContent(this.get('content').slice());
    },

    // When items are removed from the source array, we have to remove the sort index observer on them
    // and remove them from the content array.
    _sourceArrayWillChange: function(source, start, removeCount, addCount) {
        var content = this.get('content');
        var self = this;
        this._withObserversSuppressed(function() {

            if (start === 0 && removeCount === content.get("length")) { // Optimize for mass changes.
                // Assumes that source and content arrays contain the same stuff
                content.replace(0, removeCount);
                content.forEach(function(item) { self._removeSortIndexObserverFor(item); });
            } else {
                for (var i = start; i < start + removeCount; i++) {
                    var removedItem = source.objectAt(i);
                    content.removeObject(removedItem);
                    self._removeSortIndexObserverFor(removedItem);
                }
            }
        });
        // No need to sort here, removal doesn't affect sort order
    },

    // When new items are added to the source array, we have to register sort index observer on them
    // and add them to the content array, maintaining correct sort order.
    _sourceArrayDidChange: function(source, start, removeCount, addCount) {
        var contentCopy = this.get('content').slice();

        if (addCount > 0) {
            for (var i = start; i < start + addCount; i++) {
                var addedItem = source.objectAt(i);
                this._addSortIndexObserverAndRegisterForRemoval(addedItem);
                contentCopy.push(addedItem);
            }
            this._sortAndReplaceContent(contentCopy);  // Only sort if there was additions
        }
    },

    _contentArrayWillChange: function(content, start, removeCount, addCount) {
        var source = this.get('source');
        var self = this;
        this._withObserversSuppressed(function() {
            for (var i = start; i < start + removeCount; i++) {
                var removedItem = content.objectAt(i);
                source.removeObject(removedItem);
                self._removeSortIndexObserverFor(removedItem);
            }
        });
    },

    _contentArrayDidChange: function(content, start, removeCount, addCount) {
    // var time = new Date().getTime();
        if (addCount > 0) {
            var sortKey = this.get('sortKey');
            var source = this.get('source');
            var self = this;
            this._withObserversSuppressed(function() {
                content.forEach(function(item, i) {
                    Ember.setPath(item, sortKey, i);
                });

                for (var i = start; i < start + addCount; i++) {
                    var addedItem = content.objectAt(i);
                    self._addSortIndexObserverAndRegisterForRemoval(addedItem);
                    source.pushObject(addedItem);
                }
            });
        }
     },

    // TODO might be useful to make the replacing more fine-grained?
    _sortAndReplaceContent: function(newContent) {
        var content = this.get('content');
        ember_assert('Must pass a copy of content, sorting the real content directly bypasses array observers!', content !== newContent);

        this._sort(newContent);
        this._withObserversSuppressed(function() {
            content.replace(0, content.get('length'), newContent);
        });
    },

    _sort: function(array) {
        var sortKey = this.get('sortKey');
        array.sort(function(o1, o2) {
            return Ember.compare(Ember.getPath(o1, sortKey), Ember.getPath(o2, sortKey));
        });
    },

    _withObserversSuppressed: function(func) {
        if (this._suppressObservers) return;  // If already suppressed, abort

        this._suppressObservers = true;
        try {
            func.call();
        } finally {
            this._suppressObservers = false;
        }
    }

});
Ember.mixin(String.prototype, {
    truncate: function(maxLength) {
        var length = Ember.none(maxLength) ? 30 : maxLength;
        if (this.length <= length) {
            return this.toString();
        } else {
            return this.substr(0, length) + '...';
        }
    },

    isBlank: function() {
        return this.trim().length === 0;
    }
});

Flame.TableCell = function(opts) {
    this.value = null;
    for (var key in opts) {
        if (opts.hasOwnProperty(key)) {
            this[key] = opts[key];
        }
    }
};

Flame.TableCell.prototype.formattedValue = function() {
    return this.value === null ? '' : this.value;
};

Flame.TableCell.prototype.editableValue = function() {
    throw 'Not implemented';
};

Flame.TableCell.prototype.validate = function(newValue) {
    return true;
};

Flame.TableCell.prototype.formatValueForBackend = function(value) {
    throw 'Not implemented';
};

Flame.TableCell.prototype.isEditable = function() {
    return false;
};

// Returns an array of CSS classes for this cell
Flame.TableCell.prototype.cssClasses = function() {
    return [];
};

Flame.TableCell.prototype.cssClassesString = function() {
    return "";
};
Flame.TableHeader = Ember.Object.extend({
    isClickable: false,

    headerLabel: function() {
        return this.get('label');
    }.property('label').cacheable(),

    createCell: function(data) {
        throw 'Not implemented';
    }
});
Flame.TableSortSupport = {
    sortAscendingCaption: 'Sort ascending...',
    sortDescendingCaption: 'Sort descending...',

    sortContent: function(sortDescriptor) {
        throw 'Not implemented!';
    },

    columnHeaderClicked: function(header, targetElement) {
        this._showSortMenu(header, this._sortMenuOptions(header), targetElement);
    },

    _showSortMenu: function(header, options, anchorView) {
        //set width based on longest item title
        var longestTitle = options.map(function(i) { return i.title.length; }).max();
        var menu = Flame.MenuView.create({
            items: options,
            layout: { width: longestTitle * 8 },
            target: this,
            action: 'sortContent',
            payloadBinding: 'value'
        });
        menu.popup(anchorView);
    },

    _sortMenuOptions: function(header) {
        return [
            {title: this.get('sortAscendingCaption'), value: {header: header, order: 'asc'}},
            {title: this.get('sortDescendingCaption'), value: {header: header, order: 'desc'}}
        ];
    }
};
Flame.TableViewContentAdapter = Ember.Object.extend({
    content: null,

    headers: function() {
        return this.getPath('content._headers');
    }.property('content._headers').cacheable(),

    columnLeafs: function() {
        return this.getPath('content.columnLeafs');
    }.property('content.columnLeafs').cacheable(),

    rowLeafs: function() {
        return this.getPath('content.rowLeafs');
    }.property('content.rowLeafs').cacheable(),

    columnHeaderRows: function() {
        var columnHeaderRows = [];
        var headers = this.get('headers');
        var columnHeaders = headers.columnHeaders;
        var columnHeadersLength = columnHeaders.length;
        var i;
        for (i = 0; i < columnHeadersLength; i++) {
            this._processHeader(columnHeaderRows, columnHeaders[i], 'columns', 0);
        }

        columnHeaderRows.maxDepth = this.get('columnLeafs').map(function (x) { return x.depth; }).max();
        for (i = 0; i < this.get('columnLeafs').length; i++) {
            var colLeaf = this.get('columnLeafs')[i];
            colLeaf.rowspan = columnHeaderRows.maxDepth - colLeaf.depth + 1;
        }

        return columnHeaderRows;
    }.property('headers').cacheable(),

    rowHeaderRows: function() {
        var rowHeaderRows = [[]];
        var headers = this.get('headers');
        var rowHeaders = headers.rowHeaders;
        var rowHeadersLength = rowHeaders.length;
        for (i = 0; i < rowHeadersLength; i++) {
            this._processHeader(rowHeaderRows, rowHeaders[i], 'rows', 0, i === 0);
        }

        var maxDepth = 0;
        for (i = 0; i < this.get('rowLeafs').length; i++) {
            var depth = this.get('rowLeafs')[i].depth;
            if (depth > maxDepth) {
                maxDepth = depth;
            }
        }
        rowHeaderRows.maxDepth = this.get('rowLeafs').map(function (x) { return x.depth; }).max();
        for (i = 0; i < this.get('rowLeafs').length; i++) {
            var rowLeaf = this.get('rowLeafs')[i];
            rowLeaf.colspan = rowHeaderRows.maxDepth - rowLeaf.depth + 1;
        }

        return rowHeaderRows;
    }.property('headers').cacheable(),

    clear: function() {
        this._headers = null;
        this.propertyDidChange('headers');
    },

    /**
      This function does three things:

        1. If the header has a 'ref' property, look up the Field and set the
           the label so that .get('label') works like other header fields.
           We need the Field instance itself so it can be referenced by Cells
           at a later point.

        2. Calculate the colspan (rowspan) attribute to be used when rendering.
           Rowspan (colspan) will be calculated later on.


        3. Store the headers in a structure similar to the way they will be rendered,
           i.e. (for column headers) an array of rows where each row is an array of cells.
    */
    _processHeader: function(headerRows, header, type, depth, isFirst) {
        header.depth = depth + 1;

        // This representation is much easier to render
        if (type === 'columns') {
            if (!headerRows[depth]) { headerRows[depth] = []; }
            headerRows[depth].push(header);
        } else if (type === 'rows') {
            if (!isFirst) { headerRows.push([]); }
            headerRows[headerRows.length-1].push(header);
        }

        var count = 0;
        if (header.hasOwnProperty('children')) {
            var children = header.children;
            var length = children.length;
            for (var i = 0; i < length; i++) {
                var child = children[i];
                count += this._processHeader(headerRows, child, type, depth + 1, i === 0);
            }
        } else { count = 1; }

        if (type === 'columns') {
            header.colspan = count;
        } else {
            header.rowspan = count;
        }

        return count;
    }

});
/*jshint loopfunc: true */


Flame.State = Ember.Object.extend({
    gotoState: function(stateName) {
        this.get('owner').gotoState(stateName);
    },

    $: function(args) {
        args = Array.prototype.slice.call(arguments);
        var owner = this.get('owner');
        return owner.$.apply(owner, args);
    }
});

Flame.State.reopenClass({
    gotoHandler: function(stateName, returnValue) {
        return function() {
            this.gotoState(stateName);
            return returnValue === undefined ? true : returnValue;
        };
    }
});

Flame.Statechart = {
    initialState: null,
    currentState: undefined,
    _currentStateName: undefined,

    init: function() {
        this._super();

        // Look for defined states and initialize them
        var key;
        for (key in this) {
            var state = this[key];
            if (Flame.State.detect(state)) {
                this.set(key, state.create({owner: this}));
                this._setupProxyMethods(this[key]);
            }
        }
        ember_assert("No initial state defined for statechart!", !Ember.none(this.get('initialState')));
        this.gotoState(this.get('initialState'));
    },

    /**
      Sets up proxy methods so that methods called on the owner of the statechart
      will be invoked on the current state if they are not present on the owner of
      the statechart.
    */
    _setupProxyMethods: function(state) {
        for (var property in state) {
            if (state.constructor.prototype.hasOwnProperty(property) && Ember.typeOf(state[property]) === "function" &&
                !this[property] && property !== "enterState" && property !== "exitState") {
                this[property] = function(methodName) {
                    return function(args) {
                        args = Array.prototype.slice.call(arguments);
                        args.unshift(methodName);
                        return this.invokeStateMethod.apply(this, args);
                    };
                }(property);
            }
        }
    },

    gotoState: function(stateName) {
        ember_assert("Cannot go to an undefined or null state!", !Ember.none(stateName));
        var currentState = this.get('currentState');
        var newState = this.get(stateName);
        //do nothing if we are already in the state to go to
        if (currentState === newState) {
            return;
        }
        if (!Ember.none(newState) && newState instanceof Flame.State) {
            if (!Ember.none(currentState)) {
                if (currentState.exitState) currentState.exitState();
            }
            this._currentStateName = stateName;
            this.set('currentState', newState);
            if (newState.enterState) newState.enterState();
        } else {
            throw new Error("%@ is not a state!".fmt(stateName));
        }
    },

    /**
     * Is this state chart currently in a state with the given name?
     * @param stateName
     * @returns {Boolean} is this statechart currently in a state with the given name?
     */
    isCurrentlyIn: function(stateName) {
        return this._currentStateName === stateName;
    },

    invokeStateMethod: function(methodName, args) {
        args = Array.prototype.slice.call(arguments); args.shift();
        var state = this.get('currentState');
        ember_assert("Cannot invoke state method without having a current state!", !Ember.none(state) && state instanceof Flame.State);
        var method = state[methodName];
        if (Ember.typeOf(method) === "function") {
            return method.apply(state, args);
        }
    }
};

/*
  A controller that you need to use when displaying an Flame.TableView. You need to
  define _headers property and call pushDataBatch to render data (can be called
  several times to render data in batches). The headers should be Flame.TableHeader
  objects.

  There's two refined subclasses of this controller, DataTableController and
  ArrayTableController, which you may find easier to use for simple tables.
 */

Flame.TableController = Ember.Object.extend({
    dirtyCells: [],
    valuesOn: 'column',
    isLoading: false,

    /**
      Takes in an array of cell value objects, e.g.
      [{path: [2,3,8,5], value: 'MRP', count: 1, all_equal: true}, {...}]

      This data is converted to a 2-dimensional array of cells, where each cell
      is either null or an instance of the Cell class (null values represent
      cells for which data has not yet been pushed). The cell instances are
      created by calling TableHeader#createCell for either the corresponding
      row or column header (depending on 'valuesOn' property).

      The path given in the cell value object will be translated to a coordinate
      in the grid of cells. This index will be added to the dirtyCells property,
      which is an array that is used as a FIFO queue. This dirtyCells array is
      used when rendering to only update the cells that have changed since the
      last render.
    */
    pushDataBatch: function(dataBatch) {
        if (dataBatch !== undefined) {
            var headers = this.get('_headers');
            if (!headers) {
                throw "Can't push data without first setting headers!";
            }
            var dirtyCells = this.get('dirtyCells').slice(); // clone array
            var valuesOn = this.get('valuesOn');
            var fields = this.get(valuesOn + 'Leafs');
            var rowLeafs = this.get('rowLeafs');
            var columnLeafs = this.get('columnLeafs');

            var _data = this.get('_data');
            var length = dataBatch.length;
            var mapping = this.get("_indexFromPathMapping");
            var cell, index;
            for (var i = 0; i < length; i++) {
                cell = dataBatch[i];
                index = mapping[cell.path.row][cell.path.column];
                if (rowLeafs[index[0]].isTotal || columnLeafs[index[1]].isTotal) {
                    cell.isTotal = true;
                    cell.isDoubleTotal = rowLeafs[index[0]].isTotal && columnLeafs[index[1]].isTotal;
                }
                cell = fields[index[valuesOn === 'row' ? 0 : 1]].createCell(cell);
                _data[index[0]][index[1]] = cell;
                dirtyCells.push(index);
            }
            this.set('dirtyCells', dirtyCells);
        }
    },

    _indexFromPathMapping: function() {
        // To use an object as a map, each key needs to have a unique toString()-value. As arrays translate into
        // comma-separated list of their content and our content is just simple numbers and each number has a unique
        // string representation, we can use the path arrays here directly.
        var mapping = {};
        var rowLeafs = this.get('rowLeafs');
        var rowLeafsLen  = rowLeafs.length;
        var columnLeafs = this.get('columnLeafs');
        var columnLeafsLen = columnLeafs.length;

        var i,j;
        var rowCell, colCell;
        var rowMapping;
        for (i = 0; i < rowLeafsLen; i++) {
            rowCell = rowLeafs[i];
            rowMapping = mapping[rowCell.path] = {};
            for (j = 0; j < columnLeafsLen; j++) {
                colCell = columnLeafs[j];
                rowMapping[colCell.path] = [i,j];
            }
        }

        return mapping;
    }.property("rowLeafs", "columnLeafs").cacheable(),

    rowLeafs: function() {
        var headers = this.get('_headers');
        if (!headers) { return null; }
        return this._getLeafs(headers.rowHeaders, []);
    }.property('_headers').cacheable(),

    columnLeafs: function() {
        var headers = this.get('_headers');
        if (!headers) { return null; }
        return this._getLeafs(headers.columnHeaders, []);
    }.property('_headers').cacheable(),

    pathFromIndex: function(index) {
        var rowLeafs = this.get('rowLeafs');
        var columnLeafs = this.get('columnLeafs');
        return {row: rowLeafs[index[0]].path, column: columnLeafs[index[1]].path};
    },

    // Translate a path to an index in the 2-dimensional grid of data
    // see path documentation in table_data.rb for more information
    indexFromPath: function(path) {
        var mapping = this.get("_indexFromPathMapping");
        return mapping[path.row][path.column];
    },

    // Collect leaf nodes and record path to get to each leaf
    _getLeafs: function(nodes, path) {
        var node, length = nodes.length;
        var leafs = [];
        for (var i = 0; i < length; i++) {
            node = nodes[i];
            if (node.hasOwnProperty('children')) {
                var newPath = node.hasOwnProperty('id') ? path.concat(node.id) : path;
                leafs = leafs.concat(this._getLeafs(node.children, newPath));
            } else {
                node.path = path.concat(node.id);
                leafs.push(node);
            }
        }
        // Mark the leaf index
        for(i = 0; i < leafs.length; i++) {
            node = leafs[i];
            node.leafIndex = i;
        }
        return leafs;
    },

    // When setting headers, resolve refs and record extra information to make rendering easier
    _headersDidChange: function() {
        var headers = this.get('_headers');
        if (!Ember.none(headers)) {
            var data = [];
            this.set('dirtyCells', []);

            // fill this.data with nulls, will be fetched lazily later
            var rowLength = this.get('rowLeafs').length;
            var columnLength = this.get('columnLeafs').length;
            for (i = 0; i < rowLength; i++) {
                data.push([]);
                for (var j = 0; j < columnLength; j++) {
                    data[i].push(null);
                }
            }
            this.set('_data', data);
        }
    }.observes('_headers')

});


/*
  A helper class that accepts the table data as a two-dimensional array (array of rows, where
  each row is an array of cell values for that row). Example:

  Flame.TableView.extend({
      content: Flame.DataTableController.create({
          headers: {
              columnHeaders: [{label: 'Col1'}, {label: 'Col2'}],
              rowHeaders: [{label: 'Row1'}, {label: 'Row2'}, {label: 'Row3'}]
          },
          data: [
              ['cell1', 'cell2'],
              ['cell3', 'cell4'],
              ['cell5', 'cell6']
          ]
      })
  })

  If you need a bit of customization, you can override properties 'headerClass' and 'cellClass'.
  Also have a look at ArrayTableController.
 */

Flame.DataTableController = Flame.TableController.extend({
    headers: null,
    data: null,

    init: function() {
        this._super();
        this._headersDidChange();
    },

    _headers: function() {
        var headers = this.get('headers');
        return {
            rowHeaders: this._wrapHeaders(headers.rowHeaders || []),
            columnHeaders: this._wrapHeaders(headers.columnHeaders || [])
        };
    }.property('headers').cacheable(),

    _wrapHeaders: function(headers) {
        var self = this;
        var headerClass = this.get('headerClass');
        return headers.map(function(header, i) {
            var wrapped = headerClass.create({id: i}, header);
            var children = wrapped.get('children');
            if (children) {
                wrapped.set('children', self._wrapHeaders(children));
            }
            return wrapped;
        });
    },

    headerClass: function() {
        var cellClass = this.get('cellClass');
        return Flame.TableHeader.extend({
            createCell: function(cellData) {
                return new cellClass({value: cellData.value});
            }
        });
    }.property().cacheable(),

    cellClass: Flame.TableCell,

    _transformData: function(data) {
        var flatData = [];
        data.forEach(function(row, i) {
            row.forEach(function(cellValue, j) {
                flatData.push({ path: {row: [i], column: [j]}, value: cellValue });
            });
        });
        return flatData;
    },

    _headersDidChange: function() {
        this._super();
        var data = this.get('data');
        if (data) {
            // We push all the data in one batch as we don't need to go fetching it from anywhere
            this.pushDataBatch(this._transformData(data));
        }
    }.observes('headers')

});



Flame.ArrayTableController = Flame.DataTableController.extend(Flame.TableSortSupport, {
    content: [],  // Set to an array of objects to display (rows)
    columns: [],  // Set to an array of labels+properties to display for each object (columns)
    headerProperty: null,  // What to display on the (row) headers
    rowHeadersClickable: false,

    headers: function() {
        var headerProperty = this.get('headerProperty');
        ember_assert('headerProperty not defined for ArrayTableAdapter!', !!headerProperty);
        var rowHeadersClickable = this.get('rowHeadersClickable');
        return {
            rowHeaders: this.get('content').map(function(object, i) {
                return {
                    isClickable: rowHeadersClickable,
                    label: object.get(headerProperty),
                    object: object
                };
            }),
            columnHeaders: this.get('columns').map(function(column, i) {
                return {label: Ember.getPath(column, 'label'), property: Ember.getPath(column, 'property')};
            })
        };
    }.property('content.@each', 'columns', 'headerProperty', 'rowHeadersClickable').cacheable(),

    data: function() {
        var columns = this.get('columns');
        return this.get('content').map(function(object) {
            return columns.map(function(column) {
                return Ember.get(object, Ember.getPath(column, 'property'));
            });
        });
    }.property('headers').cacheable(),

    sortContent: function(sortDescriptor) {
        var property = sortDescriptor.header.get('property');
        var orderFactor = sortDescriptor.order === 'desc' ? -1 : 1;

        // Directly sorting the array bypasses all observers, better make a copy, sort that & set back
        var contentCopy = this.get('content').slice();
        contentCopy.sort(function(o1, o2) {
            return orderFactor * Ember.compare(Ember.get(o1, property), Ember.get(o2, property));
        });
        this.set('content', contentCopy);
    },

    refreshHeaders: function() {
        this.propertyWillChange('headers');
        this.propertyDidChange('headers');
    }

});
// Support for firing an action, given a target, action and an optional payload. Any of those
// can naturally be defined with a binding. Furthermore, if target is a path the resolves to
// a string, that string is again resolved as a path, etc. until it resolved on non-string.
// For example, target could be 'parentView.controller', which could resolve to
// 'MyApp.fooController', which would then resolve to a controller object. If target is not
// defined, it defaults to the view itself.
//
// Action can be defined as a string or a function. If it's a function, it's called with the
// target bound to 'this'.
//
// If payload is not defined, it defaults to the view itself.
Flame.ActionSupport = {
    target: null,
    action: null,
    payload: null,

    fireAction: function(action, payload) {
        var target = this.get('target') || null;

        if (!target) { target = this; }
        while ('string' === typeof target) {  // Use a while loop: the target can be a path gives another path
            if (target.charAt(0) === '.') {
                target = this.getPath(target.slice(1));  // If starts with a dot, interpret relative to this view
            } else {
                target = Ember.getPath(target);
            }
        }
        if (action === undefined) { action = this.get('action'); }

        if (action) {
            var actionFunction = 'function' === typeof action ? action : target[action];
            if (!actionFunction) throw 'Target %@ does not have action %@'.fmt(target, action);
            return actionFunction.call(target, payload || this.get('payload') || this, action, this);
        }

        return false;
    }
};
Ember.View.reopen({
    interpretKeyEvents: function(event) {
        var mapping = event.shiftKey ? Flame.MODIFIED_KEY_BINDINGS : Flame.KEY_BINDINGS;
        var eventName = mapping[event.keyCode];
        if (eventName && this[eventName]) {
            var handler = this[eventName];
            if (handler && Ember.typeOf(handler) === "function") {
                return handler.call(this, event, this);
            }
        }
        return false;
    },

    handleKeyEvent: function(event, view) {
        var scEvent = null;
        switch (event.type) {
            case "keydown": scEvent = 'keyDown'; break;
            case "keypress": scEvent = 'keyPress'; break;
        }
        var handler = scEvent ? this.get(scEvent) : null;
        if (window.FlameD && scEvent) FlameD.logEvent(event, scEvent, this);
        if (handler) {
            // Note that in jQuery, the contract is that event handler should return
            // true to allow default handling, false to prevent it. But in SC, event handlers return true if they handled the event,
            // false if they didn't, so we want to invert that return value here.
            return !handler.call(Flame.keyResponderStack.current(), event, Flame.keyResponderStack.current());
        } else if (scEvent === "keyDown" && this.interpretKeyEvents(event)) { // Try to hand down the event to a more specific key event handler
            return false;
        } else if (this.get('parentView')) {
            return this.get('parentView').handleKeyEvent(event, view);
        }
    }
});

Flame.KEY_BINDINGS = {
    8: 'deleteBackward',
    9: 'insertTab',
    13: 'insertNewline',
    27: 'cancel',
    32: 'insertSpace',
    37: 'moveLeft',
    38: 'moveUp',
    39: 'moveRight',
    40: 'moveDown',
    46: 'deleteForward'
};

Flame.MODIFIED_KEY_BINDINGS = {
    8: 'deleteForward',
    9: 'insertBacktab',
    37: 'moveLeftAndModifySelection',
    38: 'moveUpAndModifySelection',
    39: 'moveRightAndModifySelection',
    40: 'moveDownAndModifySelection'
};

// See Flame.TextFieldView for details on what this is needed for
Flame.ALLOW_BROWSER_DEFAULT_HANDLING = {};  // Just a marker value

Ember.mixin(Flame, {
    mouseResponderView: undefined, // Which view handled the last mouseDown event?

    /*
      Holds a stack of key responder views. With this we can neatly handle restoring the previous key responder
      when some modal UI element is closed. There's a few simple rules that governs the usage of the stack:
       - mouse click does .replace (this should also be used for programmatically taking focus when not a modal element)
       - opening a modal UI element does .push
       - closing a modal element does .pop

      Also noteworthy is that a view will be signaled that it loses the key focus only when it's popped off the
      stack, not when something is pushed on top. The idea is that when a modal UI element is opened, we know
      that the previously focused view will re-gain the focus as soon as the modal element is closed. So if the
      previously focused view was e.g. in the middle of some edit operation, it shouldn't cancel that operation.
    */
    keyResponderStack: Ember.Object.create({
        _stack: [],

        // Observer-friendly version of getting current
        currentKeyResponder: function() {
            return this.current();
        }.property(),

        current: function() {
            var length = this._stack.get('length');
            if (length > 0) return this._stack.objectAt(length - 1);
            else return undefined;
        },

        push: function(view) {
            if (!Ember.none(view)) {
                if (view.willBecomeKeyResponder) view.willBecomeKeyResponder();
                //console.log('View %s became key responder', Ember.guidFor(view));
                if (view.set && !view.isDestroyed) view.set('isFocused', true);
                this._stack.push(view);
                if (view.didBecomeKeyResponder) view.didBecomeKeyResponder();
                this.propertyDidChange('currentKeyResponder');
            }
            return view;
        },

        pop: function() {
            if (this._stack.get('length') > 0) {
                var current = this.current();
                if (current && current.willLoseKeyResponder) current.willLoseKeyResponder();  // Call before popping, could make a difference
                var view = this._stack.pop();
                //console.log('View %s will lose key responder', Ember.guidFor(view));
                if (view.set && !view.isDestroyed) view.set('isFocused', false);
                if (view.didLoseKeyResponder) view.didLoseKeyResponder();
                this.propertyDidChange('currentKeyResponder');
                return view;
            }
            else return undefined;
        },

        replace: function(view) {
            if (this.current() !== view) {
                this.pop();
                return this.push(view);
            }
        }
    })
});

// Set up a handler on the document for key events.
Ember.$(document).on('keydown.sproutcore keypress.sproutcore', null, function(event, triggeringManager) {
    if (Flame.keyResponderStack.current() !== undefined && Flame.keyResponderStack.current().get('isVisible')) {
        return Flame.keyResponderStack.current().handleKeyEvent(event, Flame.keyResponderStack.current());
    }
    return true;
});

// This logic is needed so that the view that handled mouseDown will receive mouseMoves and the eventual mouseUp, even if the
// pointer no longer is on top of that view. Without this, you get inconsistencies with buttons and all controls that handle
// mouse click events. The sproutcore event dispatcher always first looks up 'eventManager' property on the view that's
// receiving an event, and let's that handle the event, if defined. So this should be mixed in to all the Flame views.
Flame.EventManager = {
    // Set to true in your view if you want to accept key responder status (which is needed for handling key events)
    acceptsKeyResponder: false,

    /*
      Sets this view as the target of key events. Call this if you need to make this happen programmatically.
      This gets also called on mouseDown if the view handles that, returns true and doesn't have property 'acceptsKeyResponder'
      set to false. If mouseDown returned true but 'acceptsKeyResponder' is false, this call is propagated to the parent view.

      If called with no parameters or with replace = true, the current key responder is first popped off the stack and this
      view is then pushed. See comments for Flame.keyResponderStack above for more insight.
    */
    becomeKeyResponder: function(replace) {
        if (this.get('acceptsKeyResponder') !== false && !this.get('isDisabled')) {
            if (replace === undefined || replace === true) {
                Flame.keyResponderStack.replace(this);
            } else {
                Flame.keyResponderStack.push(this);
            }
        } else {
            var parent = this.get('parentView');
            if (parent && parent.becomeKeyResponder) return parent.becomeKeyResponder(replace);
        }
    },

    /*
      Resign key responder status by popping the head off the stack. The head might or might not be this view,
      depending on whether user clicked anything since this view became the key responder. The new key responder
      will be the next view in the stack, if any.
    */
    resignKeyResponder: function() {
        Flame.keyResponderStack.pop();
    },

    eventManager: {
        mouseDown: function(event, view) {
            view.becomeKeyResponder();  // Becoming a key responder is independent of mouseDown handling
            Flame.set('mouseResponderView', undefined);
            var handlingView = this._dispatch('mouseDown', event, view);
            if (handlingView) {
                Flame.set('mouseResponderView', handlingView);
            }
            return !handlingView;
        },

        mouseUp: function(event, view) {
            if (Flame.get('mouseResponderView') !== undefined) {
                view = Flame.get('mouseResponderView');
                Flame.set('mouseResponderView', undefined);
            }
            return !this._dispatch('mouseUp', event, view);
        },

        mouseMove: function(event, view) {
            if (Flame.get('mouseResponderView') !== undefined) {
                view = Flame.get('mouseResponderView');
            }
            return !this._dispatch('mouseMove', event, view);
        },

        keyDown: function(event) {
            if (Flame.keyResponderStack.current() !== undefined && Flame.keyResponderStack.current().get('isVisible')) {
                return Flame.keyResponderStack.current().handleKeyEvent(event, Flame.keyResponderStack.current());
            }
            return true;
        },

        keyPress: function(event) {
            if (Flame.keyResponderStack.current() !== undefined && Flame.keyResponderStack.current().get('isVisible')) {
                return Flame.keyResponderStack.current().handleKeyEvent(event, Flame.keyResponderStack.current());
            }
            return true;
        },

        // For the passed in view, calls the method with the name of the event, if defined. If that method
        // returns true, returns the view. If the method returns false, recurses on the parent view. If no
        // view handles the event, returns false.
        _dispatch: function(eventName, event, view) {
            if (window.FlameD) FlameD.logEvent(event, eventName, view);
            var handler = view.get(eventName);
            if (handler) {
                var result = handler.call(view, event, view);
                if (result === Flame.ALLOW_BROWSER_DEFAULT_HANDLING) return false;
                else if (result) return view;
            }
            var parentView = view.get('parentView');
            if (parentView) return this._dispatch(eventName, event, parentView);
            else return false;
        }
    }
};

Flame.FocusSupport = {
    // To make text fields/areas behave consistently with our concept of key responder, we have to also
    // tell the browser to focus/blur the input field
    didBecomeKeyResponder: function() {
        this.$().focus();
    },

    didLoseKeyResponder: function() {
        this.$().blur();
    },

    focusIn: function() {
        if (Flame.keyResponderStack.current() !== this) {
            this.becomeKeyResponder();
        }
    },

    focusOut: function() {
        if (Flame.keyResponderStack.current() === this) {
            this.resignKeyResponder();
        }
    }
};


// Mix this into any view. Calling enterFullscreen then makes the view shown fullscreen. An 'exit fullscreen' button is
// shown automatically on the right upper corner on top of everything.
//
// TODO Make this work on IE7. The problem is that the modal pane covers everything, only the close button appears on top.
Flame.FullscreenSupport = {
    isFullscreen: false,

    _oldAttributes: undefined,
    _pane: undefined,
    _button: undefined,

    modalPane: function() {
        return Flame.View.create({
            layout: { left: 0, top: 0, right: 0, bottom: 0 },
            classNames: ['flame-fullscreen-pane'],
            owner: undefined
        });
    }.property(),

    closeButton: function() {
        return Flame.ButtonView.create({
            layout: { right: 3, top: 3, width: 24, height: 24 },
            classNames: ['flame-fullscreen-close'],
            // XXX image support in ButtonView?
            handlebars: "<img style='margin: 3px;' src='%@'>".fmt(Flame.image('full_screen_off.png')),
            action: function() {
                this.getPath('owner').exitFullscreen();
            }
        });
    }.property(),

    // A statechart would perhaps make sense here, but as FullscreenSupport is meant to be mixed in to any view
    // you want full-screenable, that view might already be using a statechart for other purposes?
    enterFullscreen: function() {
        if (!this.get('isFullscreen')) {
            // The close button cannot be a child of the pane, because then it's not shown in front of the fullscreen stuff.
            // This is apparently because the pane establishes a stacking context, see http://www.w3.org/TR/CSS21/visuren.html#propdef-z-index
            var pane, closeButton;
            this.set('_pane', pane = this.get('modalPane'));
            this.set('_button', closeButton = this.get('closeButton'));
            pane.set('owner', this);
            closeButton.set('owner', this);
            pane.append();
            closeButton.append();

            var element = this.$();
            var oldAttributes = {
                left: element.css('left'), 
                top: element.css('top'),
                right: element.css('right'),
                bottom: element.css('bottom'),
                width: element.css('width'),
                height: element.css('height'),
                position: element.css('position'),
                zIndex: element.css('zIndex')
            };

            // If both left & right or top & bottom is defined, discard width/height to keep the layout fluid when exiting fullscreen
            if (oldAttributes.left !== 'auto' && oldAttributes.right !== 'auto') oldAttributes.width = undefined;
            if (oldAttributes.top !== 'auto' && oldAttributes.bottom !== 'auto') oldAttributes.height = undefined;
            this.set('_oldAttributes', oldAttributes);

            element.css({ left: 0, top: 0, right: 0, bottom: 0, width: '', height: '', position: 'fixed', zIndex: '50' });

            this.set('isFullscreen', true);
        }
    },

    exitFullscreen: function() {
        if (this.get('isFullscreen')) {
            this.$().css(this.get('_oldAttributes'));
            this.get('_pane').remove();
            this.get('_button').remove();

            this.set('isFullscreen', false);
        }
    }
};
// Support for defining the layout with a hash, e.g. layout: {left: 10, top: 10, width: 100, height: 30}
Flame.LayoutSupport = {
    useAbsolutePosition: true,
    concatenatedProperties: ['displayProperties'],
    layout: {left: 0, right: 0, top: 0, bottom: 0},
    defaultWidth: undefined,
    defaultHeight: undefined,
    layoutManager: undefined,
    rootView: false,

    _layoutProperties: ['left', 'right', 'top', 'bottom', 'width', 'height'],
    _cssProperties: ['left', 'right', 'top', 'bottom', 'width', 'height', 'margin-left', 'margin-top'],
    _layoutChangeInProgress: false,
    _layoutSupportInitialized: false,

    init: function() {
        this._super();
        this._initLayoutSupport();
        this.consultLayoutManager();
        this.updateLayout();  // Make sure CSS is up-to-date, otherwise can sometimes get out of sync for some reason
    },

    createChildView: function(view, attrs) {
        view = this._super(view, attrs);
        Flame._bindPrefixedBindings(view);
        return view;
    },

    // When using handlebars templates, the child views are created only upon rendering, not in init.
    // Thus we need to consult the layout manager also at this point.
    didInsertElement: function() {
        this._super();
        this.consultLayoutManager();
    },

    childViewsDidChange: function() {
        this._super.apply(this, arguments);
        this.consultLayoutManager();
    },

    _initLayoutSupport: function() {
        // Do this initialization even if element is not currently using absolute positioning, just in case
        var layout = Ember.Object.create(Ember.copy(this.get('layout')));  // Clone layout for each instance in case it's mutated (happens with split view)

        if (layout.width === undefined && layout.right === undefined && this.get('defaultWidth') !== undefined) {
            layout.width = this.get('defaultWidth');
        }
        if (layout.height === undefined && (layout.top === undefined || layout.bottom === undefined) && this.get('defaultHeight') !== undefined) {
            layout.height = this.get('defaultHeight');
        }

        this.set('layout', layout);

        // For changes to the layout it's enough to update the DOM
        this.addObserver('layout', this, this.updateLayout);

        this._layoutSupportInitialized = true;
    },

    _renderElementAttributes: function(buffer) {
        ember_assert('Layout support has not yet been initialized!', !!this._layoutSupportInitialized);
        if (!this.get('useAbsolutePosition')) return;

        var layout = this.get('layout') || {};
        this._resolveLayoutBindings(layout);
        var cssLayout = this._translateLayout(layout);

        this._cssProperties.forEach(function(prop) {
            var value = cssLayout[prop];
            if (!Ember.none(value)) {
                buffer.style(prop, value);
            }
        });
        if (layout.zIndex !== undefined) buffer.style('z-index', layout.zIndex);

        var backgroundColor = this.get('backgroundColor');
        if (backgroundColor !== undefined) buffer.style('background-color', backgroundColor);

        buffer.addClass('flame-view');
    },

    render: function(buffer) {
        this._renderElementAttributes(buffer);
        return this._super(buffer);
    },

    _resolveLayoutBindings: function(layout) {
        if (layout._bindingsResolved) return;  // Only add the observers once, even if rerendered
        var self = this;
        this._layoutProperties.forEach(function(prop) {
            var value = layout[prop];
            // Does it look like a property path (and not e.g. '50%')?
            if (!Ember.none(value) && 'string' === typeof value && value !== '' && isNaN(parseInt(value, 10))) {
                // TODO remove the observer when view destroyed?
                self.addObserver(value, self, function() {
                    self.adjustLayout(prop, self.getPath(value));
                });
                layout[prop] = self.getPath(value);
            }
        });
        layout._bindingsResolved = true;
    },

    // Given a layout hash, translates possible centerX and centerY to appropriate CSS properties
    _translateLayout: function(layout) {
        var cssLayout = {};

        cssLayout.width = layout.width;
        if (layout.centerX === undefined) {
            cssLayout.left = layout.left;
            cssLayout.right = layout.right;
        } else {
            cssLayout.left = '50%';
            cssLayout['margin-left'] = (-((layout.width || 0) / 2) + layout.centerX) + 'px';
        }

        cssLayout.height = layout.height;
        if (layout.centerY === undefined) {
            cssLayout.top = layout.top;
            cssLayout.bottom = layout.bottom;
        } else {
            cssLayout.top = '50%';
            cssLayout['margin-top'] = (-((layout.height || 0) / 2) + layout.centerY) + 'px';
        }

        this._cssProperties.forEach(function(prop) {
            var value = cssLayout[prop];
            // If a number or a string containing only a number, append 'px'
            if (value !== undefined && ('number' === typeof value || parseInt(value, 10).toString() === value)) {
                cssLayout[prop] = value+'px';
            }
        });

        return cssLayout;
    },

    // If layout manager is defined, asks it to recompute the layout, i.e. update the positions of the child views
    consultLayoutManager: function() {
        // View initializations might result in calling this method before they've called our init method.
        // That causes very bad effects because the layout property has not yet been cloned, which means
        // that several views might be sharing the layout property. So just ignore the call if not initialized.
        if (!this._layoutSupportInitialized) return;

        // This if needed to prevent endless loop as the layout manager is likely to update the children, causing this method to be called again
        if (!this._layoutChangeInProgress) {
            this._layoutChangeInProgress = true;
            try {
                var layoutManager = this.get('layoutManager');
                if (layoutManager !== undefined) layoutManager.setupLayout(this);
            } finally {
                this._layoutChangeInProgress = false;
            }
        }
    },

    layoutDidChangeFor: function(childView) {
        this.consultLayoutManager();
    },

    // Can be used to adjust one property in the layout. Updates the DOM automatically.
    adjustLayout: function(property, value, increment) {
        ember_assert('Layout support has not yet been initialized!', !!this._layoutSupportInitialized);

        var layout = this.get('layout');
        var oldValue = layout[property];
        var newValue;
        if (value !== undefined) {
            newValue = value;
        } else if (increment !== undefined) {
            newValue = oldValue + increment;
        } else throw 'Give either a new value or an increment!';

        if (oldValue !== newValue) {
            layout[property] = newValue;
            this.updateLayout();
        }
    },

    // Call this method to update the DOM to reflect the layout property, without recreating the DOM element
    updateLayout: function() {
        ember_assert('Layout support has not yet been initialized!', !!this._layoutSupportInitialized);

        if (this.get('useAbsolutePosition')) {
            var cssLayout = this._translateLayout(this.get('layout') || {});
            var element = this.get('element');
            if (element) {
                jQuery(element).css(cssLayout);
            } else {
                // Apparently not yet in DOM - should be fine though, we update the layout in didInsertElement
            }
        }

        var parentView = this.get('parentView');
        if (parentView && parentView.layoutDidChangeFor) parentView.layoutDidChangeFor(this);
    }.observes('isVisible'),

    // XXX: isVisible property doesn't seem to always get set properly, so make sure it is true
    isVisible: true,

    _isVisibleWillChange: function() {
        var callback;
        if (!this.get('isVisible')) {
            callback = 'willBecomeVisible';
        } else {
            callback = 'willBecomeHidden';
        }
        this.invokeRecursively(function(view) {
            if (view[callback]) view[callback].apply(view);
        });
    }.observesBefore('isVisible')
};




/*
  Layout managers are helpers that you can delegate setting the layout properties to when you get
  tired of doing it manually. They can also update the layout on the fly by reacting to changes
  in the layout of child views.
*/

Flame.LayoutManager = Ember.Object.extend({
    setupLayout: undefined
});
/*
  VerticalStackLayoutManager is a layout manager that stacks the children vertically, with optional
  top margin, spacing and bottom margin. Use in your view e.g. like this;

   layout: { right: 220, top: 60, width: 200 },
   layoutManager: Flame.VerticalStackLayoutManager.create({ spacing: 10 }),

  Each child view should define layout.height. For the parent view it's set automatically. Should any
  of the child views change their height, the layout is updated automatically. If a childView has
  property 'ignoreLayoutManager' set to true, its layout is not affected nor considered here.
  Similarly, elements with isVisible false are ignored.

  TODO: make ignoreLayoutManager handling more generic if/when more layout managers are implemented
*/

Flame.VerticalStackLayoutManager = Flame.LayoutManager.extend({
    topMargin: 0,
    bottomMargin: 0,
    spacing: 0,

    setupLayout: function(view) {
        var self = this;
        var top = self.get('topMargin');
        var len = view.get('childViews').get('length');
        var fluid = false, isFirst = true;

        view.get('childViews').forEach(function(childView, i) {
            if ('string' === typeof childView) throw 'Child views have not yet been initialized!';
            if (childView.get('ignoreLayoutManager') !== true &&
                (childView.get('isVisible') || childView.get('isVisible') === null) && // isVisible is initially null
                childView.get('layout')) {
                if (!isFirst) {  // Cannot check the index because some child views may be hidden and must be ignored
                    top += self.get('spacing');
                } else {
                    isFirst = false;
                }

                var layout = childView.get('layout');
                childView._resolveLayoutBindings(layout);  // XXX ugly
                ember_assert('All child views must define layout when using VerticalStackLayoutManager!', !Ember.none(layout));

                top += (layout.topMargin || 0);
                childView.adjustLayout('top', top);  // Use adjustLayout, it checks if the property changes (can trigger a series of layout updates)
                top += (layout.topPadding || 0) + (layout.bottomPadding || 0);  // if view has borders, these can be used to compensate

                var height = layout.height;
                if ('string' === typeof height) height = parseInt(height, 10);
                if (i < len-1) {  // XXX should not check the index, this check should only consider visible child views
                    ember_assert('All child views except last one must define layout.height when using VerticalStackLayoutManager!', !Ember.none(height));
                }

                if (Ember.none(layout.height)) {
                    fluid = true;
                } else {
                    top += height;
                }
            }
        });

        // fluid == true means that the last child has no height set, meaning that it's meant to fill in the rest of the parent's view.
        // In that case, we must not set parent's height either, because the system is supposed to remain fluid (i.e. bottom is set).
        if (!fluid) {
            top += this.get('bottomMargin');
            view.adjustLayout('height', top);
        }
    }
});





Ember.View.reopen({
    // Finds the first descendant view for which given property evaluates to true. Proceeds depth-first.
    firstDescendantWithProperty: function(property) {
        var result;
        this.forEachChildView(function(childView) {
            if (result === undefined) {
                if (childView.get(property)) {
                    result = childView;
                } else {
                    result = childView.firstDescendantWithProperty(property);
                }
            }
        });
        return result;
    }
});

Flame.reopen({
    ALIGN_LEFT: 'align-left',
    ALIGN_RIGHT: 'align-right',
    ALIGN_CENTER: 'align-center',

    POSITION_BELOW: 1 << 0,
    POSITION_RIGHT: 1 << 1,
    POSITION_LEFT: 1 << 2,
    POSITION_ABOVE: 1 << 3,
    POSITION_MIDDLE: 1 << 4,

    FOCUS_RING_MARGIN: 3
});

// Base class for Flame views. Can be used to hold child views or render a template. In SC2, you normally either use
// Ember.View for rendering a template or Ember.ContainerView to render child views. But we want to support both here, so
// that we can use e.g. Flame.ListItemView for items in list views, and the app can decide whether to use a template or not.
Flame.View = Ember.ContainerView.extend(Flame.LayoutSupport, Flame.EventManager, {
    displayProperties: [],
    isFocused: false,  // Does this view currently have key focus?

    init: function() {
        this._super();

        // There's a 'gotcha' in SC2 that we need to work around here: an Ember.View does not have child views in the sense
        // that you cannot define them yourself. But when used with a handlebars template, Ember.View uses child views
        // internally to keep track of dynamic portions in the template so that they can be updated in-place in the DOM.
        // The template rendering process adds this kind of child views on the fly. The problem is that we need to extend
        // Ember.ContainerView here (see above), and that observes the child views to trigger a re-render, which then happens
        // when we're already in the middle of a render, crashing with error 'assertion failed: You need to provide an
        // object and key to `get`' (happens because parent buffer in a render buffer is null).
        if (this.get('template')) {
            this.set('states', Ember.View.states);  // Use states from Ember.View to remedy the problem
        }

        // Add observers for displayProperties so that the view gets rerendered if any of them changes
        var properties = this.get('displayProperties') || [];
        for (var i = 0; i < properties.length; i++) {
            var property = properties[i];
            this.addObserver(property, this, this.rerender);
        }

    },

    render: function(buffer) {
        this._renderElementAttributes(buffer);
        // If a template is defined, render that, otherwise use ContainerView's rendering (render childViews)
        var template = this.get('template');
        if (template) {
            // Copied from Ember.View for now
            var output = template(this.get('templateContext'), { data: { view: this, buffer: buffer, isRenderData: true } });
            if (output !== undefined) { buffer.push(output); }
        } else {
            return this._super(buffer);
        }
    },

    template: function() {
        var str = this.get('handlebars');
        return str ? this._compileTemplate(str) : null;
    }.property('templateName', 'handlebars').cacheable(),

    // Compiles given handlebars template, with caching to make it perform better. (Called repetitively e.g.
    // when rendering a list view whose item views use a template.)
    _compileTemplate: function(template) {
        var compiled = Flame._templateCache[template];
        if (!compiled) {
            //console.log('Compiling template: %s', template);
            Flame._templateCache[template] = compiled = Ember.Handlebars.compile(template);
        }
        return compiled;
    }
});

Flame._templateCache = {};
Flame.ImageView = Flame.View.extend({
    templateContext: function() {
        return { value: this.get('value') };
    }.property('value'),

    handlebars: '<img {{bindAttr src="value"}}>'
});

/* 
   Use this view at the top of the view hierarchy, either directly or as a superclass.
   The rootView property is needed for being able to set up the prefixed bindings, see
   Flame._bindPrefixedBindings for more info.
*/

Flame.RootView = Flame.View.extend({
    rootView: true
});
Flame.LabelView = Flame.View.extend(Flame.ActionSupport, {
    layout: { left: 0, top: 0 },
    classNames: ['flame-label-view'],
    classNameBindings: ['textAlign', 'isSelectable'],
    defaultHeight: 22,
    defaultWidth: 200,
    isSelectable: false,

    handlebars: '{{value}}',

    render: function(buffer) {
        var height = this.getPath('layout.height');
        if (this.get('useAbsolutePosition') && !Ember.none(height)) buffer.style('line-height', height+'px');
        this._super(buffer);
    },

    mouseDown: function(evt) {
        return this.fireAction();
    },

    // We should never let mouseUp propagate. If we handled mouseDown, we will receive mouseUp and obviously
    // it shouldn't be propagated. If we didn't handle mouseDown (there was no action), it was propagated up
    // and the mouse responder logic will relay mouseUp directly to the view that handler mouseDown.
    mouseUp: function(evt) {
        return true;
    }
});

Flame.LabelView.reopenClass({
    // Shortcut for creating label views with a static label
    label: function(value, left, top, width, height) {
        return Flame.LabelView.extend({
            layout: { left: left, top: top, width: width, height: height },
            value: value
        });
    },

    // Shortcut for creating label views using a binding
    binding: function(valueBinding, left, top, width, height) {
        return Flame.LabelView.extend({
            layout: { left: left, top: top, width: width, height: height },
            valueBinding: valueBinding
        });
    }
});



// When multiple panels with modal panes are shown at the same time, we need this to get them to stack on
// top of each other. If they use a static z-index, all the panels would appear on top of all the modal panes.
Flame._zIndexCounter = 100;

// A pop-up panel, modal or non-modal. The panel is destroyed on closing by default. If you intend to reuse the same
// panel instance, set destroyOnClose: false.
Flame.Panel = Flame.RootView.extend({
    classNames: ['flame-panel'],
    childViews: ['titleView', 'contentView'],
    destroyOnClose: true,
    acceptsKeyResponder: true,
    isModal: true,
    allowClosingByClickingOutside: true,
    allowMoving: false,
    dimBackground: true,
    title: null,
    isShown: false,

    _keyResponderOnPopup: undefined,

    init: function() {
        ember_assert('Flame.Panel needs a contentView!', !!this.get('contentView'));
        this._super();
    },

    titleView: Flame.View.extend(Flame.Statechart, {
        layout: { left: 0, right: 0, height: 26, bottomPadding: 1 },
        classNames: ['flame-panel-title'],
        childViews: ['labelView'],
        isVisibleBinding: Ember.Binding.from('parentView.title').isNull().not(),
        initialState: 'idle',

        labelView: Flame.LabelView.extend({
            layout: { left: 4, right: 4, top: 2 },
            textAlign: Flame.ALIGN_CENTER,
            valueBinding: 'parentView.parentView.title'
        }),

        idle: Flame.State.extend({
            mouseDown: function(event) {
                var owner = this.get('owner');
                if (!owner.getPath('parentView.allowMoving')) {
                    return true;
                }
                owner._pageX = event.pageX;
                owner._pageY = event.pageY;
                var offset = owner.get('parentView').$().offset();
                owner._panelX = offset.left;
                owner._panelY = offset.top;
                this.gotoState('moving');
                return true;
            }
        }),

        moving: Flame.State.extend({
            mouseMove: function(event) {
                var owner = this.get('owner');
                var newX = owner._panelX + (event.pageX - owner._pageX);
                var newY = owner._panelY + (event.pageY - owner._pageY);
                var element = owner.get('parentView').$();
                newX = Math.max(5, Math.min(newX, Ember.$(window).width() - element.outerWidth() - 5));  // Constrain inside window
                newY = Math.max(5, Math.min(newY, Ember.$(window).height() - element.outerHeight() - 5));
                element.css({left: newX, top: newY, right: '', bottom: '', marginLeft: '', marginTop: ''});
                return true;
            },
            mouseUp: Flame.State.gotoHandler('idle')
        })
    }),

    // This is the pane that's used to obscure the background if isModal === true
    modalPane: function() {
        return Flame.RootView.create({
            layout: { left: 0, top: 0, right: 0, bottom: 0 },
            classNames: ['flame-modal-pane'],
            classNameBindings: ['parentPanel.dimBackground'],

            parentPanel: null,
            mouseDown: function() {
                if (this.getPath('parentPanel.allowClosingByClickingOutside')) {
                    this.get('parentPanel').close();
                }
                return true;
            }
        });
    }.property(),

    insertNewline: function(event) {
        var defaultButton = this.firstDescendantWithProperty('isDefault');
        if (defaultButton && defaultButton.simulateClick) {
            defaultButton.simulateClick();
        }
        return true;
    },

    _layoutRelativeTo: function(anchor, position) {
        position = position || Flame.POSITION_BELOW;
        var layout = this.get('layout');

        var anchorElement = anchor instanceof jQuery ? anchor : anchor.$();
        var offset = anchorElement.offset();

        if (position & Flame.POSITION_BELOW) {
            layout.top = offset.top + anchorElement.outerHeight();
            layout.left = offset.left;
            if (position & Flame.POSITION_MIDDLE) {
                layout.left = layout.left - (layout.width / 2) + (anchorElement.outerWidth() / 2);
            }
        } else if (position & Flame.POSITION_RIGHT) {
            layout.top = offset.top;
            layout.left = offset.left + anchorElement.outerWidth();
            if (position & Flame.POSITION_MIDDLE) {
                layout.top = layout.top - (layout.height / 2) + (anchorElement.outerHeight() / 2);
            }
        } else {
            ember_assert('Invalid position for panel', false);
        }

        // Make sure the panel is still within the viewport horizontally ...
        var _window = Ember.$(window);
        if (layout.left + layout.width > _window.width() - 10) {
            layout.left = _window.width() - layout.width - 10;
        }
        // ... and vertically
        if (layout.top + layout.height > _window.height() - 10) {
            layout.top = _window.height() - layout.height - 10;
        } else if (layout.top < 0) { layout.top = 10; }
        return layout;
    },

    popup: function(anchor, position) {
        if (!this.get('isShown')) {
            if (this.get('isModal')) {
                var modalPane = this.get('modalPane');
                modalPane.set('parentPanel', this);
                modalPane.get('layout').zIndex = Flame._zIndexCounter;
                modalPane.append();
                this.set('_modalPane', modalPane);
            }

            if (anchor) {
                this.set("layout", this._layoutRelativeTo(anchor, position));
            }
            this.get('layout').zIndex = Flame._zIndexCounter + 10;
            Flame._zIndexCounter += 100;

            this.append();
            this.set('isShown', true);
            if (this.get('acceptsKeyResponder')) this.becomeKeyResponder(false);
            this._focusDefaultInput();
        }
    },

    close: function() {
        if (this.isDestroyed) { return; }
        if (this.get('isShown')) {
            if (this.get('isModal')) {
                this.get('_modalPane').remove();
            }
            this.remove();
            this.set('isShown', false);
            if (this.get('acceptsKeyResponder')) this.resignKeyResponder();
            Flame._zIndexCounter -= 100;

            if (this.get('destroyOnClose')) this.destroy();
        }
    },

    _focusDefaultInput: function() {
        // Let SC render the element before we focus it
        Ember.run.next(this, function() {
            var defaultFocus = this.firstDescendantWithProperty('isDefaultFocus');
            if (defaultFocus) { defaultFocus.becomeKeyResponder(); }
        });
    }
});

Flame.ButtonView = Flame.View.extend(Flame.ActionSupport, Flame.Statechart, {
    defaultHeight: 24,
    classNames: ['flame-button-view'],
    classNameBindings: ['isHovered', 'isActive', 'isSelected', 'isDisabled', 'isDefault', 'isFocused'],
    acceptsKeyResponder: true,
    isHovered: false,
    isActive: false,
    isSelected: false,  // for 'sticky' buttons, means that the button is stuck down (used for tab views)
    isDisabled: false,
    isDefault: false,  // If true, fires in a panel when user hits enter
    isSticky: false,  // If true, each click (mouseUp to be specific) toggles 'isSelected'
    initialState: 'idle',

    handlebars: "<label class='flame-button-label'>{{title}}</label>",

    render: function(buffer) {
        var height = this.getPath('layout.height');
        if (this.get('useAbsolutePosition') && !Ember.none(height)) buffer.style('line-height', (height-2)+'px');  // -2 to account for borders
        this._super(buffer);
    },

    insertSpace: function(event) {
        this.simulateClick();
        return true;
    },

    idle: Flame.State.extend({
        mouseEnter: function() {
            this.gotoState('hover');
            return true;
        },

        simulateClick: function() {
            this.gotoState('hover');
            this.get('owner').simulateClick();
            Ember.run.later(this.get('owner'), 'mouseLeave', 150);
        }
    }),

    hover: Flame.State.extend({
        mouseLeave: function() {
            this.gotoState('idle');
            return true;
        },

        mouseDown: function() {
            if (!this.getPath('owner.isDisabled')) {
                this.gotoState('mouseDownInside');
            }
            return true;
        },

        simulateClick: function() {
            this.mouseDown();
            Ember.run.later(this.get('owner'), 'mouseUp', 100);
        },

        enterState: function() {
            this.get('owner').set('isHovered', true);
        },

        exitState: function() {
            var owner = this.get('owner');
            // Because the mouseLeave event is executed via Ember.run.later, it can happen that by the time we exitState
            // the owner has been destroyed
            if (!owner.isDestroyed) {
                owner.set('isHovered', false);
            }
        }
    }),

    mouseDownInside: Flame.State.extend({
        mouseUp: function() {
            this.get('owner').fireAction();
            if (this.getPath('owner.isSticky')) {
                this.setPath('owner.isSelected', !this.getPath('owner.isSelected'));
            }
            this.gotoState('hover');
            return true;
        },

        mouseLeave: function() {
            this.gotoState('mouseDownOutside');
            return true;
        },

        enterState: function() {
            this.get('owner').set('isActive', true);
        },

        exitState: function() {
            this.get('owner').set('isActive', false);
        }
    }),

    mouseDownOutside: Flame.State.extend({
        mouseUp: function() {
            this.gotoState('idle');
            return true;
        },

        mouseEnter: function() {
            this.gotoState('mouseDownInside');
            return true;
        }
    })
});





Flame.AlertPanel = Flame.Panel.extend();

Flame.AlertPanel.INFO_ICON = Flame.image('info_icon.png');
Flame.AlertPanel.WARN_ICON = Flame.image('warn_icon.png');
Flame.AlertPanel.ERROR_ICON = Flame.image('error_icon.png');

Flame.AlertPanel.reopen({
    layout: { centerX: 0, centerY: -50, width: 400, height: 155 },
    classNames: 'flame-alert-panel'.w(),
    icon: Flame.AlertPanel.INFO_ICON,
    isModal: true,
    allowClosingByClickingOutside: false,
    allowMoving: true,
    isCancelVisible: true,
    title: '',
    message: '',
    cancelButtonTitle: 'Cancel',
    confirmButtonTitle: 'OK',

    contentView: Flame.View.extend({
        layout: { left: 15, right: 15, top: 36, bottom: 15 },
        childViews: 'iconView messageView cancelButtonView okButtonView'.w(),

        iconView: Flame.ImageView.extend({
            layout: { left: 10, top: 10 },
            valueBinding: 'parentView.parentView.icon'
        }),

        messageView: Flame.LabelView.extend({
            layout: { left: 75, top: 10, right: 2, bottom: 30 },
            valueBinding: 'parentView.parentView.message'
        }),

        cancelButtonView: Flame.ButtonView.extend({
            layout: { width: 90, bottom: 2, right: 110 },
            titleBinding: 'parentView.parentView.cancelButtonTitle',
            isVisibleBinding: 'parentView.parentView.isCancelVisible',
            action: function() {
                this.getPath('parentView.parentView').onCancel();
            }
        }),

        okButtonView: Flame.ButtonView.extend({
            layout: { width: 90, bottom: 2, right: 2 },
            titleBinding: 'parentView.parentView.confirmButtonTitle',
            isDefault: true,
            action: function() {
                this.getPath('parentView.parentView').onConfirm();
            }
        })
    }),

    // Key event handler for ESC
    cancel: function() {
        this.onCancel();
    },

    // override this to actually do something when user clicks OK
    onConfirm: function() {
        this.close();
    },

    // override this to actually do something when user clicks Cancel
    onCancel: function() {
        this.close();
    }
});


Flame.AlertPanel.reopenClass({
    info: function(config) {
        config = jQuery.extend(config || {}, {icon: Flame.AlertPanel.INFO_ICON, isCancelVisible: false});
        return Flame.AlertPanel.create(config);
    },
    warn: function(config) {
        config = jQuery.extend(config || {}, {icon: Flame.AlertPanel.WARN_ICON});
        return Flame.AlertPanel.create(config);
    },
    error: function(config) {
        config = jQuery.extend(config || {}, {icon: Flame.AlertPanel.ERROR_ICON});
        return Flame.AlertPanel.create(config);
    }
});


// A checkbox. The state of the checkbox is indicated by the isSelected property (in SC1.x it was value).
Flame.CheckboxView = Flame.ButtonView.extend({
    classNames: ['flame-checkbox-view'],
    isSticky: true,
    //Overwrite the parent handlebars as we're using render all the way!
    handlebars: null,

    render: function(context) {
        this._super(context);
        context.push("<div class='flame-checkbox-box'></div>");
        this.renderCheckMark(context);
        var title = Ember.none(this.get("title")) ? "" : this.get("title");
        context.push("<label class='flame-checkbox-label'>" + title + "</label>");
    },

    renderCheckMark: function(context) {
        var imgUrl = Flame.image('checkmark.png');
        context.push("<div class='flame-view flame-checkbox-checkmark' style='left:5px;'><img src='"+ imgUrl + "'></div>");
    }
});

Flame.CollectionView =  Ember.CollectionView.extend(Flame.LayoutSupport, Flame.EventManager, {
    classNames: ['flame-list-view']
});

Flame.DisclosureView = Flame.LabelView.extend({
    classNames: ['flame-disclosure-view'],
    buttonBinding: Ember.Binding.from('visibilityTarget').transformTrueFalse(
        Flame.image('disclosure_triangle_down.png'),
        Flame.image('disclosure_triangle_left.png')
    ),
    handlebars: '<img {{bindAttr src="button"}}> {{value}}',
    action: function() {
        var value = this.getPath('visibilityTarget');
        this.setPath('visibilityTarget', !value);
        return true;
    }
});

//
// You must set on object to 'object' that the form manipulates (or use a binding)
// Optionally you can set a defaultTarget, that will be used to set the default target for any actions
// triggered from the form (button clicks and default submit via hitting enter)
//
Flame.FormView = Flame.View.extend({
    classNames: ['form-view'],
    tagName: 'form',

    defaultTarget: null,
    object: null,
    properties: [],

    leftMargin: 20,
    rightMargin: 20,
    topMargin: 20,
    bottomMargin: 20,
    rowSpacing: 10,
    columnSpacing: 10,
    buttonSpacing: 15,
    labelWidth: 150,
    labelAlign: Flame.ALIGN_RIGHT,
    buttonWidth: 90,
    controlWidth: null,// set this if you want to force a set control width
    defaultFocus: null,
    buttons: [],
    _focusRingMargin: 3,

    _errorViews: [],

    yesNoItems: [
        {title: 'Yes', value: true},
        {title: 'No', value: false}
    ],

    init: function() {
        this._super();

        this.set('layoutManager', Flame.VerticalStackLayoutManager.create({
            topMargin: this.get('topMargin'),
            spacing: this.get('rowSpacing'),
            bottomMargin: this.get('bottomMargin')
        }));

        this._propertiesDidChange();
    },

    _propertiesDidChange: function() {
        this.destroyAllChildren();

        var self = this;
        var childViews = this.get('childViews');
        this.get('properties').forEach(function(descriptor) {
            var view = self._createLabelAndControl(descriptor);
            childViews.push(self.createChildView(view));
        });

        var buttons = this.get('buttons');
        if (buttons && buttons.get('length') > 0) {
            childViews.push(this.createChildView(this._buildButtons(buttons)));
        }
    }.observes('properties.@each'),

    _createLabelAndControl: function(descriptor) {
        descriptor = Ember.Object.create(descriptor);
        var control = descriptor.view || this._buildControl(descriptor);
        var formView = this;

        if (Ember.none(descriptor.label)) {
            return this._createChildViewWithLayout(control, this, this.get('leftMargin') + this._focusRingMargin, this.get('rightMargin') + this._focusRingMargin);
        }

        var view = {
            layout: { left: this.get('leftMargin'), right: this.get('rightMargin') },
            layoutManager: Flame.VerticalStackLayoutManager.create({ topMargin: this._focusRingMargin, spacing: 0, bottomMargin: this._focusRingMargin }),
            childViews: ['label', 'control'],

            isVisible: descriptor.get('isVisible') || true,

            label: this._buildLabel(descriptor),
            control: function () {
                return formView._createChildViewWithLayout(control, this, formView.labelWidth + formView.columnSpacing, formView._focusRingMargin);
            }.property().cacheable()
        };
        if (descriptor.get('isVisibleBinding')) view.isVisibleBinding = descriptor.get('isVisibleBinding');

        return Flame.View.extend(view);
    },

    _createChildViewWithLayout: function(view, parent, leftMargin, rightMargin) {
        var childView = parent.createChildView(view);
        if (!childView.get('layout')) childView.set('layout', {});
        childView.setPath('layout.left', leftMargin);
        childView.setPath('layout.right', rightMargin);
        return childView;
    },

    _buildLabel: function(descriptor) {
        return Flame.LabelView.extend({
            layout: { left: 0, width: this.get('labelWidth'), top: this._focusRingMargin },
            ignoreLayoutManager: true,
            textAlign: this.get('labelAlign'),
            value: descriptor.get('label') + ':'
        });
    },

    _buildButtons: function(buttons) {
        var formView = this;
        return Flame.View.extend({
            layout: { left: this.get('leftMargin'), right: this.get('rightMargin'), topMargin: this.get('buttonSpacing'), height: 30 },
            init: function() {
                this._super();
                var childViews = this.get('childViews');
                var right = formView._focusRingMargin;
                var self = this;
                (buttons || []).forEach(function(descriptor) {
                    var buttonView = self.createChildView(formView._buildButton(descriptor, right));
                    right += (buttonView.getPath('layout.width') || 0) + 15;
                    childViews.push(buttonView);
                });
            }
        });
    },

    _buildButton: function(descriptor, right) {
        var properties = jQuery.extend({
            targetBinding: '^defaultTarget'
        }, descriptor);

        if (!properties.layout) {
            properties.layout = { width: this.get('buttonWidth'), right: right };
        }
        properties.layout.top = this._focusRingMargin;

        //if an explicit target is set, we don't want the default targetBinding to be used
        if (descriptor.target) {
            delete properties.targetBinding;
        }

        return Flame.ButtonView.extend(properties);
    },

    _buildValidationObservers: function(validationMessage) {
        if (Ember.none(validationMessage)) return {};

        var self = this;
        return {
            didInsertElement: function() {
                this._super();
                this.isValidDidChange(); // In case the field is initially invalid
            },

            isValidWillChange: function() {
                var errorView = this.get('_errorView');
                // We change from being invalid to valid and have an error view.
                if (errorView && !this.get('isValid')) {
                    errorView.remove();
                    this.set('_errorView', null);
                    self._errorViews = self._errorViews.without(errorView);
                }
            }.observesBefore('isValid'),

            isValidDidChange: function() {
                if (!this.get('isValid') && !this.get('_errorView')) {
                    var element = this.$();
                    var offset = element.offset();

                    // This is strictly not necessary, but currently you can save invalid form with enter, which then fails here
                    if (Ember.none(offset)) return;

                    var zIndex = Flame._zIndexCounter;
                    var errorView = Flame.LabelView.extend({
                        classNames: 'flame-form-view-validation-error'.w(),
                        textAlign: Flame.ALIGN_LEFT,
                        layout: { top: offset.top - 7, left: offset.left + element.outerWidth() - 4, width: null, height: null, zIndex: zIndex },
                        value: validationMessage,
                        handlebars: '<div class="error-triangle"></div><div class="error-box">{{value}}</div>'
                    }).create().append();

                    this.set("_errorView", errorView);
                    self._errorViews.push(errorView);
                }
            }.observes("isValid")
        };
    },

    _buildControl: function(descriptor) {
        var property = descriptor.get('property');
        var object = this.get('object');
        var settings = {
            layout: { topPadding: 1, bottomPadding: 1, width: this.get('controlWidth') },
            valueBinding: '^object.%@'.fmt(property),
            // FIXME: this is required instead of just .not() because isValid properties are initially null
            isValidBinding: Ember.Binding.from('^object.%@IsValid'.fmt(property)).transform(function(v) {
                //Allow for undefined/null values when the fooIsValid property is not defined
                return v !== false;
            })
        };
        if (this.get('defaultFocus') === property) {
            settings.isDefaultFocus = true;
        }

        var validator = descriptor.get('validate');
        if (validator) {
            // Set up on-the-fly validation here.
            if (!object.get('validations')) { object.set('validations', {}); }
            object.setValidationFor(property, validator);
        }
        jQuery.extend(settings, this._buildValidationObservers(descriptor.get('validation')));
        var type = descriptor.get('type') || 'text';
        if (descriptor.options || descriptor.optionsBinding) type = 'select';

        // If a text field (or similar), emulate good old html forms that submit when hitting return by
        // clicking on the default button. This also prevents submitting of disabled forms.
        if (Ember.none(settings.action) && (type === 'text' || type === 'textarea' || type === 'password')) {
            var form = this;
            settings.fireAction = function() {
                var defaultButton = form.firstDescendantWithProperty('isDefault');
                if (defaultButton && defaultButton.simulateClick) {
                    defaultButton.simulateClick();
                }
            };
        }

        settings.classNames = settings.classNames || [];
        settings.classNames.push("form-view-" + type);

        return this._buildControlView(settings, type, descriptor);
    },

    _buildControlView: function(settings, type, descriptor) {
        switch (type) {
            case 'readonly':
                settings.isEditable = true;
                // readonly fields are selectable by default
                settings.isSelectable = descriptor.get('isSelectable') === false ? false : true;
                return Flame.LabelView.extend(settings);
            case 'text':
                return Flame.TextFieldView.extend(settings);
            case 'textarea':
                settings.layout.height = descriptor.height || 70;
                return Flame.TextAreaView.extend(settings);
            case 'password':
                settings.isPassword = true;
                return Flame.TextFieldView.extend(settings);
            case 'html':
                return Flame.LabelView.extend(jQuery.extend(settings, {escapeHTML: false, formatter: function(val) {
                    return val === null ? '' : val;
                }}));
            case 'checkbox':
                return Flame.CheckboxView.extend(settings);
            case 'select':
                settings.itemValueKey = descriptor.itemValueKey || "value";
                settings.subMenuKey = descriptor.subMenuKey || "subMenu";
                if (descriptor.optionsBinding) {
                    settings.itemTitleKey = descriptor.itemTitleKey || "name";
                    settings.itemsBinding = descriptor.optionsBinding;
                } else if (descriptor.options) {
                    settings.itemTitleKey = descriptor.itemTitleKey || "title";
                    settings.items = descriptor.options;
                }
                return Flame.SelectButtonView.extend(settings);
            case 'yesno':
                settings.itemTitleKey = "title";
                settings.itemValueKey = "value";
                settings.items = this.get('yesNoItems');
                return Flame.SelectButtonView.extend(settings);
        }
        throw 'Invalid control type %@'.fmt(type);
    },

    willDestroyElement: function() {
        this._errorViews.forEach(function(e) { e.remove(); });
    }

});
Flame.HorizontalSplitView = Flame.View.extend({
    classNames: ['flame-horizontal-split-view'],
    childViews: ['leftView', 'dividerView', 'rightView'],
    allowResizing: true,
    leftWidth: 100,
    rightWidth: 100,
    minLeftWidth: 0,
    minRightWidth: 0,
    dividerWidth: 7,
    flex: 'right',
    resizeInProgress: false,

    _unCollapsedLeftWidth: undefined,
    _unCollapsedRightWidth: undefined,
    _resizeStartX: undefined,
    _resizeStartLeftWidth: undefined,
    _resizeStartRightWidth: undefined,

    init: function() {
        ember_assert('Flame.HorizontalSplitView needs leftView and rightView!', !!this.get('leftView') && !!this.get('rightView'));
        this._super();

        if (this.get('flex') === 'right') this.rightWidth = undefined;
        else this.leftWidth = undefined;

        this._updateLayout();  // Update layout according to the initial widths

        this.addObserver('leftWidth', this, this._updateLayout);
        this.addObserver('rightWidth', this, this._updateLayout);
        this.addObserver('minLeftWidth', this, this._updateLayout);
        this.addObserver('minRightWidth', this, this._updateLayout);
    },

    _updateLayout: function() {
        // Damn, this is starting to look complicated...
        var leftView = this.get('leftView');
        var dividerView = this.get('dividerView');
        var rightView = this.get('rightView');

        var totalWidth = Ember.$(this.get('element')).innerWidth();
        var dividerWidth = this.get('dividerWidth');

        var leftWidth = this.get('flex') === 'right' ? this.get('leftWidth') : undefined;
        var rightWidth = this.get('flex') === 'left' ? this.get('rightWidth') : undefined;
        if (leftWidth === undefined && rightWidth !== undefined && totalWidth !== null) leftWidth = totalWidth - rightWidth - dividerWidth;
        if (rightWidth === undefined && leftWidth !== undefined && totalWidth !== null) rightWidth = totalWidth - leftWidth - dividerWidth;

        //console.log('leftWidth %@, totalWidth %@, rightWidth %@'.fmt(leftWidth, totalWidth, rightWidth));

        if ('number' === typeof leftWidth && leftWidth < this.get('minLeftWidth')) {
            rightWidth += leftWidth - this.get('minLeftWidth');
            leftWidth = this.get('minLeftWidth');
        }
        if ('number' === typeof rightWidth && rightWidth < this.get('minRightWidth')) {
            leftWidth += rightWidth - this.get('minRightWidth');
            rightWidth = this.get('minRightWidth');
        }
        this.set('leftWidth', leftWidth);
        this.set('rightWidth', rightWidth);

        if (this.get('flex') === 'right') {
            this._setDimensions(leftView, 0, leftWidth, undefined);
            this._setDimensions(dividerView, leftWidth, dividerWidth, undefined);
            this._setDimensions(rightView, leftWidth + dividerWidth, undefined, 0);
        } else {
            this._setDimensions(leftView, 0, undefined, rightWidth + dividerWidth);
            this._setDimensions(dividerView, undefined, dividerWidth, rightWidth);
            this._setDimensions(rightView, undefined, rightWidth, 0);
        }
    },

    _setDimensions: function(view, left, width, right) {
        var layout = view.get('layout');
        layout.set('left', left);
        layout.set('width', width);
        layout.set('right', right);
        layout.set('top', 0);
        layout.set('bottom', 0);

        view.updateLayout();
    },

    toggleCollapse: function(evt) {
        if (this.get('allowResizing')) {
            if (this.get('flex') === 'right') {
                if (this.get('leftWidth') === this.get('minLeftWidth') && this._unCollapsedLeftWidth !== undefined) {
                    this.set('leftWidth', this._unCollapsedLeftWidth);
                } else {
                    this._unCollapsedLeftWidth = this.get('leftWidth');
                    this.set('leftWidth', this.get('minLeftWidth'));
                }
            } else {
                if (this.get('rightWidth') === this.get('minRightWidth') && this._unCollapsedRightWidth !== undefined) {
                    this.set('rightWidth', this._unCollapsedRightWidth);
                } else {
                    this._unCollapsedRightWidth = this.get('rightWidth');
                    this.set('rightWidth', this.get('minRightWidth'));
                }
            }
            this.endResize();
        }
    },

    startResize: function(evt) {
        if (this.get('allowResizing')) {
            this.set('resizeInProgress', true);
            this._resizeStartX = evt.pageX;
            this._resizeStartLeftWidth = this.get('leftWidth');
            this._resizeStartRightWidth = this.get('rightWidth');
            return true;
        }
        return false;
    },

    resize: function(evt) {
        if (this.get('resizeInProgress')) {
            if (this.get('flex') === 'right') {
                this.set('leftWidth', this._resizeStartLeftWidth + (evt.pageX - this._resizeStartX));
            } else {
                this.set('rightWidth', this._resizeStartRightWidth - (evt.pageX - this._resizeStartX));
            }
            return true;
        }
        return false;
    },

    endResize: function(evt) {
        this.set('resizeInProgress', false);
        return true;
    },

    dividerView: Flame.View.extend({
        classNames: ['flame-split-view-divider'],

        mouseDown: function(evt) {
            return this.get('parentView').startResize(evt);
        },
        mouseMove: function(evt) {
            return this.get('parentView').resize(evt);
        },
        mouseUp: function(evt) {
            return this.get('parentView').endResize(evt);
        },
        doubleClick: function(evt) {
            return this.get('parentView').toggleCollapse(evt);
        }
    })
});
Flame.ListItemView = Flame.View.extend({
    useAbsolutePosition: false,
    classNames: ['flame-list-item-view'],
    classNameBindings: ['isSelected', 'parentView.allowReordering', 'isDragged'],
    isSelected: false,
    _parentViewOnMouseDown: undefined,
    displayProperties: ['content'],
    acceptsKeyResponder: false,
    childListView: null,

    mouseMove: function(evt) {
        if (this._parentViewOnMouseDown !== undefined) {
            return this._parentViewOnMouseDown.mouseMove(evt);
        } else {
            return false;
        }
    },

    mouseDown: function(evt) {
        // As a result of a drag operation, this view might get detached from the parent, but we still need to
        // relay the mouseUp event to that parent, so store it here into _parentViewOnMouseDown.
        this._parentViewOnMouseDown = this.get('parentView');
        return this._parentViewOnMouseDown.mouseDownOnItem(this.get('contentIndex'), evt);
    },

    mouseUp: function(evt) {
        if (this._parentViewOnMouseDown !== undefined) {
            var parentView = this._parentViewOnMouseDown;
            this._parentViewOnMouseDown = undefined;
            return parentView.mouseUpOnItem(evt);
        } else {
            return false;
        }
    }
});
/*
  This helper class hides the ugly details of doing dragging in list views and tree views.

  One challenge in the implementation is how to designate a specific potential drop position.
  For a list of items, a natural choice would be to use an insert position: e.g. 0 would mean
  insert as the first item, 5 would mean insert as the fifth item. We can extend this for
  tree views by using an array of indexes: [2, 1, 4] would mean take the child number 2 from
  the topmost list, then child number 1 from the next, and insert the item as the fourth
  child of that. But there's an added complexity: When the item being moved is removed from
  its parent, all other items inside that parent shift, potentially changing the meaning of a
  path array. This means that while calculating a potential drop position, and when actually
  doing the insertion, positions potentially have a different meaning. It can be taken into
  account but it results into convoluted code.

  Better approach is to use unambiguous drop position designators. Such a designator can be
  constructed by naming an existing item in the tree (identified with a path *before* the
  item being moved is removed), and stating the insertion position relative to that. We need
  three insertion position indicators: before, after and inside (= as the first child, needed
  when there's currently no children at all). We can represent those as letters 'b', 'a' and
  'i'. This is handled in the nested Path class.

  In order to support dragging, items on all levels must provide a property 'childListView'
  thar returns the view that has as its children all the items on the next level. If the
  object has nothing underneath it, it must return null.
  This is useful when the item views are complex and do not directly contain their child
  items as their only child views.

  See for example the following tree:

          A
         /|\
        / | \
       Z  X  Y
          |   \
          V    3
         / \
        2   4

  Here V is not ItemView but others are. Then A and Y should return itself, X should return V, and
  1 to 4 and Z should return null.
 */

Flame.ListViewDragHelper = Ember.Object.extend({
    listView: undefined,
    lastPageX: undefined,
    yOffset: undefined,
    itemPath: undefined,
    lastTargetContent: null,

    clone: undefined,
    mouseMoveCounter: 0,

    // Creates a clone of the dragged element and dims the original
    initReorder: function() {
        var newItemPath = Flame.ListViewDragHelper.Path.create({array: this.itemPath, root: this.listView});
        this.itemPath = newItemPath;
        // XXX very ugly...
        this.reorderCssClass = this.isTree() ? '.flame-tree-item-view-container' : '.flame-list-item-view';

        var view = this.itemPath.getView();

        // Don't set the opacity by using element-style but instead set appropriate class. Thus IE filters disappear
        // when they're no longer required for opacity. Plus this automatically restores the original opacity to the
        // element.
        view.set("isDragged", true);
        var element = view.$();
        var clone = element.clone();

        clone.attr('id', element.attr('id')+"_drag");
        clone.addClass('is-dragged-clone');
        clone.appendTo(this.get('listView').$());

        clone.css('opacity', 0.8);

        this.set('clone', clone);
        this._updateCss();

        // As the clone is not linked to any SC view, we have to add custom event handlers on it
        var listView = this.get('listView');
        clone.mousemove(function(event) {
            listView.mouseMove.apply(listView, arguments);
            return true;
        });
        clone.mouseup(function(event) {
            listView.mouseUp.apply(listView, arguments);
            return true;
        });
    },

    // Moves the clone to match the current mouse position and moves the dragged item in the list/tree if needed
    updateDisplay: function(evt, scheduled) {
        // This logic discards mouseMove events scheduled by the scrolling logic in case there's been a real mouseMove event since scheduled
        if (scheduled === undefined) this.mouseMoveCounter++;
        else if (scheduled < this.mouseMoveCounter) return false;

        this._updateDraggingCloneAndScrollPosition(evt);
        var newPath = this._resolveNewPath(evt.pageX, evt.pageY);

        if (newPath && !this.itemPath.equals(newPath)) {
            var view = this.itemPath.getView();
            this._moveItem(this.itemPath, newPath);
            this.itemPath = this._resolvePath(view);
            this._updateCss();
            this.lastPageX = evt.pageX;  // Reset the reference point for horizontal movement every time the item is moved
        }

        return true;
    },

    finishReorder: function() {
        var itemPathView = this.itemPath.getView();
        this.get('listView').didReorderContent(itemPathView.getPath('parentView.content'));
        itemPathView.set("isDragged", false);
        this.clone.remove();  // Remove the clone holding the clones from the DOM
    },

    // Updates the css classes and 'left' property of the clone and its children, needed for fixing indentation
    // to match the current item position in a tree view.
    _updateCss: function() {
        var draggedElement = this.itemPath.getView().$();
        var rootOffsetLeft = this.clone.offsetParent().offset().left;

        this.clone.attr('class', draggedElement.attr('class') + ' is-dragged-clone');
        this.clone.css('left', draggedElement.offset().left - rootOffsetLeft);

        var originals = this.itemPath.getView().$().find('.flame-tree-item-view', '.flame-tree-view');
        var children = this.clone.find('.flame-tree-item-view', '.flame-tree-view');
        children.each(function(i) {
            var element = jQuery(this), origElement = jQuery(originals.get(i));
            element.attr('class', origElement.attr('class'));
            rootOffsetLeft = element.offsetParent().offset().left;
            element.css('left', origElement.offset().left - rootOffsetLeft);
        });
    },

    // Moves the dragged element in the list/tree to a new location, possibly under a new parent
    _moveItem: function(sourcePath, targetPath) {
        var view = sourcePath.getView();
        var contentItem = view.get('content');
        var sourceParent = view.get('parentView');
        var sourceContent = sourceParent.get('content');
        var element = view.$();

        var targetView = targetPath.getView();
        var targetElement = targetView.$();
        var targetParent = targetPath.position === 'i' ? targetPath.getNestedListView() : targetView.get('parentView');
        var targetContent = targetParent.get('content');
        var targetChildViews = targetParent.get('childViews');

        // First remove the view, the content item and the DOM element from their current parent.
        // If moving inside the same parent, use a special startMoving+endMoving API provided by
        // Flame.SortingArrayProxy to protect against non-modifiable arrays (the sort property is
        // still updated).
        if (sourceContent === targetContent && sourceContent.startMoving) sourceContent.startMoving();
        sourceParent.get('childViews').removeObject(view);
        sourceContent.removeObject(contentItem);
        sourceParent._updateContentIndexes();
        element.detach();

        // Then insert them under the new parent, at the correct position
        var targetIndex = targetView.get('contentIndex');
        if (targetPath.position === 'b') {
            element.insertBefore(targetElement);
            targetChildViews.insertAt(targetIndex, view);
            targetContent.insertAt(targetIndex, contentItem);
        } else if (targetPath.position === 'a') {
            element.insertAfter(targetElement);
            targetChildViews.insertAt(targetIndex+1, view);
            targetContent.insertAt(targetIndex+1, contentItem);
        } else if (targetPath.position === 'i') {
            targetElement.find('.flame-list-view').first().prepend(element);
            targetChildViews.insertAt(0, view);
            targetContent.insertAt(0, contentItem);
        } else throw 'Invalid insert position '+targetPath.position;

        if (sourceContent === targetContent && sourceContent.endMoving) sourceContent.endMoving();
        // We need to do this manually because ListView suppresses the childViews observers while dragging,
        // so that we can do the entire DOM manipulation ourselves here without the list view interfering.
        view.set('_parentView', targetParent);
        targetParent._updateContentIndexes();
    },

    isTree: function() {
        return this.listView instanceof Flame.TreeView;  // XXX ugly
    },

    // Considering the current drag position, works out if the dragged element should be moved to a new location
    // in the list/tree. If dragging in a ListView, we compare against the .flame-list-item-view elements. If in a
    // TreeView, we need to compare against .flame-tree-item-view-container elements, that's what contains the item
    // label (and excludes possible nested tree views).
    _resolveNewPath: function(pageX, pageY) {
        var draggedView = this.itemPath.getView();
        var draggedElement = draggedView.$();
        var itemElements = this.get('listView').$().find(this.reorderCssClass);
        // XXX very ugly
        var currentElement = this.isTree() ? draggedElement.children(this.reorderCssClass).first() : draggedElement;
        var startIndex = itemElements.index(currentElement);
        ember_assert('Start element not found', startIndex >= 0);

        var cloneTop = this.clone.offset().top;
        var cloneBottom = cloneTop + this.clone.outerHeight();
        var currentDy = cloneTop - draggedElement.offset().top;

        var direction = currentDy > 0 ? 1 : -1;  // Is user dragging the item up or down from its current position in the list?
        var i = startIndex + direction;
        var len = itemElements.length;
        var newIndex = startIndex;

        //console.log('startIndex %s, currentDy %s, len %s, i %s', startIndex, currentDy, len, i);
        while (i >= 0 && i < len) {
            var testElement = jQuery(itemElements[i]);
            if (testElement.closest('.is-dragged-clone').length > 0) break;  // Ignore the clone
            if (testElement.is(':visible') && testElement.closest(draggedElement).length === 0) {
                var thresholdY = testElement.offset().top + testElement.outerHeight() * (0.5 + direction * 0.2);
                //console.log('cloneTop %s, cloneBottom %s, i %s, test top %s, thresholdY', cloneTop, cloneBottom, i, testElement.offset().top, thresholdY);

                if ((direction > 0 && cloneBottom > thresholdY) || (direction < 0 && cloneTop < thresholdY)) {
                    newIndex = i;
                } else {
                    break;
                }
            }
            i += direction;
        }

        var targetView = Ember.View.views[jQuery(itemElements[newIndex]).closest('.flame-list-item-view').attr('id')];
        var path = this._resolvePath(targetView);

        // Path defaults to inside (i), confusingly _resolveNewLevel can also mangle position!
        var canDropInside = direction > 0 && targetView.get('hasChildren') && targetView.get('isExpanded') && !this._pathInvalid(draggedView, path);
        if (!canDropInside) {
            if (direction > 0) {
                path.position = 'a';  // a for after
            } else {
                path.position = 'b';  // b for before
            }
        }

        // Finally we need to see if the new location is a last child in a nested list view, or just after an open 'folder'.
        // If so, the vertical position is not enough to unambiguously define the desired target location, we have to also
        // check horizontal movement to decide which level to put the dragged item on.
        path = this._resolveNewLevel(draggedView, targetView, path, pageX);
        return this._pathInvalid(draggedView, path) ? null : path;
    },

    _resolveNewLevel: function(draggedView, targetView, path, pageX) {
        var xDiff = pageX - this.lastPageX;
        var xStep = 10;  // TODO obtain the real horiz. difference between the DOM elements on the different levels somehow...

        // If as the last item of a nested list, moving left moves one level up (placing immediately after current parent), OR
        // if the current level isn't valid, try and see if there is a valid drop one level up
        while ((xDiff < -xStep || this._pathInvalid(draggedView, path)) && (path.position === 'a' || this.itemPath.equals(path)) &&
               path.array.length > 1 && targetView.get('contentIndex') === targetView.getPath('parentView.childViews.length') - 1) {
            xDiff += xStep;
            path = path.up();
            targetView = path.getView();
        }

        // If previous item has children and is expanded, moving right moves the item as the last item inside that previous one, OR
        // if current level isnt valid and there is a valid preceding cousin, try that instead (notice this alters the position!)
        var precedingView;
        while ((xDiff > xStep || this._pathInvalid(draggedView, path)) && (path.position !== 'i' || this.itemPath.equals(path)) &&
               (precedingView = this._getPrecedingView(targetView)) !== undefined &&
               precedingView !== draggedView && precedingView.get('hasChildren') && precedingView.get('isExpanded') && !this._pathInvalid(draggedView, this._resolvePath(precedingView).down())) {
            xDiff -= xStep;
            path = this._resolvePath(precedingView).down();
            targetView = path.getView();
        }

        return path;
    },

    _pathInvalid: function(draggedView, targetPath) {
        var itemDragged = draggedView.get('content');
        var dropTarget = targetPath.getView().get('content');
        var newParent = null;
        if (targetPath.position === 'i') {
            newParent = dropTarget;
        }  else {
            var newParentItemView = targetPath.up().getView();
            if (newParentItemView) {
                newParent = newParentItemView.get('content');
            }
        }
        var isValid = this.get('listView').isValidDrop(itemDragged, newParent);
        return !isValid;
    },

    _getPrecedingView: function(view) {
        return view.get('contentIndex') > 0 ? view.getPath('parentView.childViews').objectAt(view.get('contentIndex') - 1) : undefined;
    },

    _resolvePath: function(view) {
        var pathArray = [];
        var listView = view.get('parentView');

        do {
            pathArray.insertAt(0, view.get('contentIndex'));
            listView = view.get('parentView');
        } while (listView.get('isNested') && (view = listView.get('parentView')) !== undefined);

        return Flame.ListViewDragHelper.Path.create({array: pathArray, root: this.listView});
    },

    _updateDraggingCloneAndScrollPosition: function(evt) {
        var domParent = this.get('listView').$();
        if (domParent.hasClass('is-nested')) domParent = domParent.offsetParent();  // If nested list in a tree, grab the topmost
        var scrollTop = domParent.scrollTop();
        var parentHeight = domParent.innerHeight();
        var newTop = evt.pageY - this.yOffset - domParent.offset().top + scrollTop;

        // Check top and bottom limits to disallow moving beyond the content area of the list view
        if (newTop < 0) newTop = 0;
        var height = this.clone.outerHeight();
        var scrollHeight = domParent[0].scrollHeight;  // See http://www.yelotofu.com/2008/10/jquery-how-to-tell-if-youre-scroll-to-bottom/
        if (newTop + height > scrollHeight) newTop = scrollHeight - height;

        this.clone.css({position: 'absolute', right: 0, top: newTop});

        // See if we should scroll the list view either up or down (don't scroll if overflow is not auto, can cause undesired tiny movement)
        if (domParent.css('overflow') === 'auto') {
            var topDiff = scrollTop - newTop;
            if (topDiff > 0) {
                domParent.scrollTo('-=%@px'.fmt(Math.max(topDiff / 5, 1)));
            }
            var bottomDiff = (newTop + height) - (scrollTop + parentHeight);
            if (bottomDiff > 0) {
                domParent.scrollTo('+=%@px'.fmt(Math.max(bottomDiff / 5, 1)));
            }
            if (topDiff > 0 || bottomDiff > 0) {  // If scrolled, schedule an artificial mouseMove event to keep scrolling
                var currentCounter = this.mouseMoveCounter;
                Ember.run.next(this, function() { this.updateDisplay(evt, currentCounter); });
            }
        }
    }

});

/*
  A helper class for the drag helper, represents a potential insert location in a list/tree.
  See docs for ListViewDragHelper above for details.
 */
Flame.ListViewDragHelper.Path = Ember.Object.extend({
    array: [],
    position: 'i',
    root: null,

    getView: function() {
        var view, i, len = this.array.length, listView = this.root;
        for (i = 0; i < len; i++) {
            var index = this.array[i];
            view = listView.get("childViews").objectAt(index);
            if (i < len - 1) {
                listView = view.get('childListView');
            }
        }
        return view;
    },

    getNestedListView: function() {
        return this.getView().get("childListView");
    },

    up: function() {
        var newArray = this.array.slice(0, this.array.length - 1);
        return Flame.ListViewDragHelper.Path.create({array: newArray, position: 'a', root: this.root});
    },

    down: function() {
        var newArray = Ember.copy(this.array);
        var newPosition;
        var nestedChildrenCount = this.getNestedListView().getPath('content.length');
        if (nestedChildrenCount > 0) {
            newArray.push(nestedChildrenCount - 1);
            newPosition = 'a';
        } else {
            newPosition = 'i';
        }
        return Flame.ListViewDragHelper.Path.create({array: newArray, position: newPosition, root: this.root});
    },

    // Ignores the position letter
    equals: function(other) {
        var len1 = this.array.length, len2 = other.array.length;
        if (len1 !== len2) return false;
        for (var i = 0; i < len1; i++) {
            if (this.array[i] !== other.array[i]) return false;
        }
        return true;
    }
});



/*
  Displays a list of items. Allows reordering if allowReordering is true.

  The reordering support is probably the most complicated part of this. It turns out that when reordering items,
  we cannot allow any of the observers on the content or childViews to fire, as that causes childViews to be
  updated, which causes flickering. Thus we update the DOM directly, and sneakily update the content and childViews
  arrays while suppressing the observers.

 */

Flame.ListView = Flame.CollectionView.extend(Flame.Statechart, {
    classNames: ['flame-list-view'],
    classNameBindings: ['isFocused'],
    acceptsKeyResponder: true,
    allowSelection: true,
    allowReordering: true,
    selection: undefined,
    initialState: 'idle',
    reorderDelegate: null,

    selectIndex: function(index) {
        if (!this.get('allowSelection')) return false;
        var content = this.get('content');
        if (content) {
            var childView = this.get('childViews').objectAt(index);
            if (childView && childView.get('isVisible') && childView.get('allowSelection') !== false) {
                var selection = content.objectAt(index);
                this.set('selection', selection);
                return true;
            }
        }
        return false;
    },

    // direction -1 for up, 1 for down
    // returns true if selection did change
    changeSelection: function(direction) {
        var content = this.get('content');
        var selection = this.get('selection');
        var index = content.indexOf(selection);
        var newIndex = index + direction, len = content.get('length');
        while (newIndex >= 0 && newIndex < len) {  // With this loop we jump over items that cannot be selected
            if (this.selectIndex(newIndex)) return true;
            newIndex += direction;
        }
        return false;
    },

    _selectionWillChange: function() {
        this._setIsSelectedStatus(this.get('selection'), false);
    }.observesBefore('selection'),

    _selectionDidChange: function() {
        this._setIsSelectedStatus(this.get('selection'), true);
    }.observes('selection'),

    _setIsSelectedStatus: function(contentItem, status) {
        if (contentItem) {
            var index = (this.get('content') || []).indexOf(contentItem);
            if (index >= 0) {
                var child = this.get('childViews').objectAt(index);
                if (child) child.set('isSelected', status);
            }
        }
    },

    // If items are removed or reordered, we must update the contentIndex of each childView to reflect their current position in the list
    _updateContentIndexes: function() {
        var childViews = this.get('childViews');
        var len = childViews.get('length');
        for (var i = 0; i < len; i++) {
            var childView = childViews.objectAt(i);
            if (childView) childView.set('contentIndex', i);
        }
        // In case the child views are using absolute positioning, also their positions need to be updated,
        // otherwise they don't appear to move anywhere.
        this.consultLayoutManager();
    },

    didReorderContent: function(content) {
        var delegate = this.get('reorderDelegate');
        if (delegate) {
            Ember.run.next(function() {
                delegate.didReorderContent(content);
            });
        }
    },

    isValidDrop: function(itemDragged, newParent) {
        var delegate = this.get('reorderDelegate');
        if (delegate && delegate.isValidDrop) {
            return delegate.isValidDrop(itemDragged, newParent);
        } else {
            return true;
        }
    },

    // Overridden in TreeView
    rootTreeView: function() {
        return this;
    }.property(),

    arrayWillChange: function(content, start, removedCount) {
        if (!this.getPath('rootTreeView.isDragging')) {
            return this._super.apply(this, arguments);
        }
    },

    arrayDidChange: function(content, start, removed, added) {
        if (!this.getPath('rootTreeView.isDragging')) {
            var result = this._super.apply(this, arguments);
            this._updateContentIndexes();
            return result;
        }
    },

    childViewsWillChange: function() {
        if (!this.getPath('rootTreeView.isDragging')) {
            return this._super.apply(this, arguments);
        }
    },

    childViewsDidChange: function() {
        if (!this.getPath('rootTreeView.isDragging')) {
            return this._super.apply(this, arguments);
        }
    },

    normalize: function(startItem) {
    },

    // Override if needed, return false to disallow reordering that particular item
    allowReorderingItem: function(itemIndex) {
        return true;
    },

    // Override to disallow certain reordering
    isValidReorderOperation: function(fromIndex, toIndex) {
        return true;
    },

    idle: Flame.State.extend({
        moveUp: function() { return this.get('owner').changeSelection(-1); },
        moveDown: function() { return this.get('owner').changeSelection(1); },

        mouseDownOnItem: function(itemIndex, evt) {
            var owner = this.get('owner');
            owner.selectIndex(itemIndex);

            // Store some information in case user starts dragging (i.e. moves mouse with the button pressed down),
            // but only if reordering is generally allowed for this list view and for the particular item
            if (owner.get('allowReordering') && itemIndex !== undefined) {
                if (owner.allowReorderingItem(itemIndex)) {
                    //console.log('Drag started on %s, dragging %s items', itemIndex, itemCount);
                    var childView = owner.get('childViews').objectAt(itemIndex);
                    owner.set('dragHelper', Flame.ListViewDragHelper.create({
                        listView: owner,
                        lastPageX: evt.pageX,
                        yOffset: evt.pageY - childView.$().offset().top,
                        itemPath: [itemIndex]
                    }));
                }
            }

            this.gotoState('mouseButtonPressed');

            // Have to always return true here because the user might start dragging, and if so, we need the mouseMove events.
            return true;
        },

        enterState: function() {
            this.get('owner').set('dragHelper', undefined);  // In case dragging was allowed but not started, clear the drag data
        }
    }),

    // This is here so that we can override the behaviour in tree views
    startReordering: function(dragHelper, event) {
        dragHelper.set('listView', this);
        this.set('dragHelper', dragHelper);
        this.gotoState('reordering');
        return this.mouseMove(event);  // Handle also this event in the new state
    },

    mouseButtonPressed: Flame.State.extend({
        mouseUpOnItem: Flame.State.gotoHandler('idle'),
        mouseUp: Flame.State.gotoHandler('idle'),

        mouseMove: function(event) {
            var owner = this.get('owner');
            if (owner.get('dragHelper')) {  // Only enter reordering state if it was allowed, indicated by the presence of dragHelper
                var dragHelper = owner.get('dragHelper');
                this.gotoState('idle');
                owner.startReordering(dragHelper, event);
            }
            return true;
        }
    }),

    reordering: Flame.State.extend({
        mouseMove: function(evt, view, scheduled) {
            return this.get('owner').get('dragHelper').updateDisplay(evt);
        },

        mouseUp: Flame.State.gotoHandler('idle'),

        // Start reorder drag operation
        enterState: function() {
            var owner = this.get('owner');
            owner.get('dragHelper').initReorder();
            owner.set('isDragging', true);
        },

        // When exiting the reorder state, we need to hide the dragged clone and restore the look of the dragged child view
        exitState: function() {
            var owner = this.get('owner');
            owner.get('dragHelper').finishReorder();
            owner.set('dragHelper', undefined);
            owner.set('isDragging', false);
        }
    })

});
Flame.LoadingIndicatorView = Flame.ImageView.extend({
    layout: { width: 16, height: 16 },
    classNames: ['loading-indicator'],
    value: Flame.image('loading.gif')
});

Flame.ScrollViewButton = Flame.View.extend({

    classNames: "scroll-element".w(),
    classNameBindings: "directionClass isShown".w(),

    directionClass: function() {
        return "scroll-%@".fmt(this.get("direction"));
    }.property(),

    isShown: false,
    direction : "down", // "up" / "down"
    useAbsolutePosition: true,

    mouseLeave: function() {
        if (this.get("isShown")) {
            this.get("parentView").stopScrolling();
            return true;
        }
        return false;
    },
    mouseEnter: function() {
        if (this.get("isShown")) {
            this.get("parentView").startScrolling(this.get("direction") === "up" ? -1 : 1);
            return true;
        }
        return false;
    },

    //Eat the clicks and don't pass them to the elements beneath.
    mouseDown: function() { return true; },
    mouseUp: function() { return true; }
});

Flame.ScrollView = Flame.View.extend({

    classNames: "scroll-view".w(),
    useAbsolutePosition: true,
    needScrolling: false,
    scrollDirection: 0,
    scrollPosition: "top", //"top", "middle", "bottom"

    childViews: "upArrow viewPort downArrow".w(),
    scrollSize: 30, //How many pixels to scroll per scroll

    viewPort:Flame.View.extend({
        useAbsolutePosition: true,
        classNames: "scroll-view-viewport".w()
    }),

    upArrow: Flame.ScrollViewButton.extend({direction:"up", layout: {height: 20, top: 0, width: "100%"}}),
    downArrow: Flame.ScrollViewButton.extend({direction:"down", layout: {height: 20, bottom: 0, width: "100%"}}),

    willDestroyElement: function() {
        this._super();
        this.stopScrolling();
    },

    setScrolledView: function(newContent) {
        this.getPath("viewPort.childViews").replace(0, 1, [newContent]);
    },

    scrollPositionDidChange: function() {
        var upArrow = this.get("upArrow");
        var downArrow = this.get("downArrow");
        var scrollPosition = this.get("scrollPosition");
        upArrow.set("isShown", this.get("needScrolling") && scrollPosition !== "top");
        downArrow.set("isShown", this.get("needScrolling") && scrollPosition !== "bottom");

    }.observes("scrollPosition", "needScrolling"),

    startScrolling: function(scrollDirection) {
        this.set("scrollDirection", scrollDirection);
        this.scroll();
    },

    stopScrolling: function() {
        this.set("scrollDirection", 0);
        if (this._timer) {
            Ember.run.cancel(this._timer);
        }
    },

    _recalculateSizes: function() {
        var height = this.getPath("parentView.layout.height");
        if (height > 0) {
            var paddingAndBorders = 5 + 5 + 1 + 1;  // XXX obtain paddings & borders from MenuView?
            this.set("layout", {height: height - paddingAndBorders, width: "100%"});
            var viewPort = this.get("viewPort");
            if (viewPort) {
                viewPort.set("layout", {
                    height: height - paddingAndBorders,
                    top: 0,
                    width: "100%"
                });
            }
        }
    }.observes("parentView.layout.height", "needScrolling"),

    _scrollTo: function(position, scrollTime) {
        var viewPort = this.get("viewPort").$();
        viewPort.scrollTo(position, {duration: scrollTime});
    },

    scroll: function() {
        var scrollDirection = this.get("scrollDirection");
        var scrollTime = 200;
        var scrollSize = this.get("scrollSize");
        var viewPort = this.get("viewPort").$();
        var oldTop = viewPort.scrollTop();
        var viewPortHeight = viewPort.height();
        var continueScrolling = true;
        var scrollPosition = this.get("scrollPosition");

        var delta = scrollSize;
        if (scrollDirection === -1) {
            if (delta > oldTop) {
                delta = oldTop;
                continueScrolling = false;
            }
        } else if (scrollDirection === 1) {
            var listHeight = this.getPath("viewPort.childViews.firstObject").$().outerHeight();
            var shownBottom = oldTop + viewPortHeight;
            if (shownBottom + delta >= listHeight) {
                delta = listHeight - shownBottom;
                continueScrolling = false;
            }
        }
        delta *= scrollDirection;
        // Animation is jaggy as there's acceleration and deceleration between each call to scroll. Optimally we
        // would only want to accelerate when the scrolling is first started and stop it only after the whole
        // scrolling has stopped.
        this._scrollTo(oldTop + delta, 0.9 * scrollTime * Math.abs(delta / scrollSize));

        if (!continueScrolling) {
            if (scrollDirection === 1) {
                scrollPosition = "bottom";
            } else if (scrollDirection === -1) {
                scrollPosition = "top";
            }
            this.stopScrolling();
        } else {
            this._timer = Ember.run.later(this, this.scroll, scrollTime);
            scrollPosition = "middle";
        }
        this.set("scrollPosition", scrollPosition);
    }

});






/* Only to be used in Flame.MenuView. Represent menu items with normal JS objects as creation of one SC object took
 * 3.5 ms on fast IE8 machine.
 */

Flame.MenuItem = function(opts) {
    var key;
    for (key in opts) {
        if (opts.hasOwnProperty(key)) {
            this[key] = opts[key];
        }
    }

    this.renderToElement = function () {
        var classes = ["flame-view", "flame-list-item-view", "flame-menu-item-view"];
        if (this.isSelected) { classes.push("is-selected"); }
        if (this.isChecked) { classes.push("is-checked"); }
        var subMenuLength = Ember.none(this.subMenuItems) ? -1 : this.subMenuItems.get('length');
        var menuIndicatorClasses = ["menu-indicator"];
        if (!this.isEnabled()) {
            classes.push("is-disabled");
        } else if (subMenuLength > 0) {
            menuIndicatorClasses.push("is-enabled");
        }
        var title = Handlebars.Utils.escapeExpression(this.title);
        var template = "<div id='%@' class='%@'><div class='title'>%@</div><div class='%@'></div></div>";
        var div = template.fmt(this.id, classes.join(" "), title, menuIndicatorClasses.join(" "));
        return div;
    };

    this.isEnabled = function() {
        return !(this.isDisabled || (this.subMenuItems && this.subMenuItems.length === 0));
    };
    this.isSelectable = function() {
        return this.isEnabled() && !this.subMenuItems;
    };
    this.elementSelector = function() {
        return Ember.$("#%@".fmt(this.id));
    };
    this.closeSubMenu = function() {
        var subMenu = this.subMenuView;
        if (!Ember.none(subMenu)) {
            subMenu.close();
            this.subMenuView = null;
        }
    };

};

/**
 * A menu. Can be shown as a "stand-alone" menu or in cooperation with a SelectButtonView.
 *
 * MenuView has a property 'subMenuKey'. Should objects based on which the menu is created return null/undefined for
 * that property, the item itself will be selectable. Otherwise if the property has more than zero values, a submenu
 * will be shown.
 *
 */
Flame.MenuView = Flame.Panel.extend(Flame.ActionSupport, {
    layout: { width: 200 },
    classNames: ['flame-menu'],
    childViews: ['contentView'],
    contentView: Flame.ScrollView,
    dimBackground: false,
    subMenuKey: 'subMenu',
    itemTitleKey: "title",
    /* Attribute that can be used to indicate a disabled menu item. The item will be disabled only if
     * isEnabled === false, not some falseish value. */
    itemEnabledKey: "isEnabled",
    itemCheckedKey: "isChecked",
    itemValueKey: "value",
    itemActionKey: "action",
    itemHeight: 21,
    /* Margin between the menu and top/bottom of the viewport. */
    menuMargin: 12,
    items: [],
    parentMenu: null,
    value: null,
    _allItemsDoNotFit: true,
    _anchorElement: null,
    _menuItems: [],
    highlightIndex: -1, // Currently highlighted index.
    userHighlightIndex: -1, // User selected highlighted index
    // Reflects the content item in this menu or the deepest currently open submenu that is currently highlighted,
    // regardless of whether mouse button is up or down. When mouse button is released, this will be set as the real
    // selection on the top-most menu, unless it's undefined (happens if currently on a non-selectable item)
    internalSelection: undefined,

    init: function() {
        this._super();
        this._needToRecreateItems();
    },

    _createMenuItems: function() {
        var items = this.get("items"),
            itemCheckedKey = this.get("itemCheckedKey"),
            itemEnabledKey = this.get("itemEnabledKey"),
            itemTitleKey = this.get("itemTitleKey"),
            itemValueKey = this.get("itemValueKey"),
            subMenuKey = this.get("subMenuKey"),
            selectedValue = this.get("value"),
            menuItems;
        menuItems = items.map(function(item, i) {
            //Only show the selection on the main menu, not in the submenus.
            return new Flame.MenuItem({
                item: item,
                isSelected: Ember.get(item, itemValueKey) === selectedValue,
                isDisabled: Ember.get(item, itemEnabledKey) === false,
                isChecked: Ember.get(item, itemCheckedKey),
                subMenuItems: Ember.get(item, subMenuKey),
                title: Ember.get(item, itemTitleKey),
                id: this._indexToId(i)
            });
        }, this);
        return menuItems;
    },

    _needToRecreateItems: function() {
        var menuItems = this._createMenuItems();
        this.set("_menuItems", menuItems);
        if (Ember.none(this.get("parentMenu"))) {
            menuItems.forEach(function(item, i) {
                if (item.isSelected) { this.set("highlightIndex", i); }
            }, this);
        }
        this.getPath("contentView").setScrolledView(this._createMenuView());
        if (this.get("_anchorElement")) {
            this._updateMenuSize();
        }

        //Set content of scroll stuff
        //calculate the the height of menu
    }.observes("items", "elementId"),

    _createMenuView: function() {
        var items = this.get("_menuItems");
        return Flame.View.create({
            useAbsolutePosition:false,
            render: function(renderingBuffer) {
                // Push strings to rendering buffer with one pushObjects call so we don't get one arrayWill/DidChange
                // per menu item.
                var tempArr = items.map(function(menuItem) { return menuItem.renderToElement(); });
                var alreadyRenderedChildren = renderingBuffer.get('childBuffers');
                alreadyRenderedChildren.pushObjects(tempArr);
            }
        });
    },

    makeSelection: function() {
        var parentMenu = this.get("parentMenu");
        var action, value;
        if (!Ember.none(parentMenu)) {
            parentMenu.makeSelection();
            this.close();
        } else {
            var internalSelection = this.get('internalSelection');
            if (typeof internalSelection !== "undefined") {
                value = Ember.get(internalSelection, this.get("itemValueKey"));
                this.set("value", value);
                //If we have an action, call it on the selection.
                action = Ember.get(internalSelection, this.get("itemActionKey")) || this.get('action');
            }
            //Sync the values before we tear down all bindings in close() which calls destroy().
            Ember.run.sync();
            // Close this menu before firing an action - the action might open a new popup, and if closing after that,
            // the new popup panel is popped off the key responder stack instead of this menu.
            this.close();
            if (!Ember.none(action)) {
                this.fireAction(action, value);
            }
        }
    },

    //This function is here to break the dependency between MenuView and MenuItemView
    createSubMenu: function(subMenuItems) {
        return Flame.MenuView.create({
            items: subMenuItems,
            parentMenu: this,
            subMenuKey: this.get("subMenuKey"),
            itemEnabledKey: this.get("itemEnabledKey"),
            itemTitleKey: this.get("itemTitleKey"),
            itemValueKey: this.get("itemValueKey"),
            itemHeight: this.get("itemHeight"),
            isModal: false
        });
    },

    closeCurrentlyOpenSubMenu: function() {
        // observers of highlightIndex should take care that closing is propagated to the every open menu underneath
        // this menu. Close() sets highlightIndex to -1, _highlightWillChange() will call closeSubMenu() on the item
        // which then calls close() on the menu it depicts and this is continued until no open menus remain under the
        // closed menu.
        var index = this.get("highlightIndex");
        if (index >= 0) {
            this.get("_menuItems").objectAt(index).closeSubMenu();
        }
    },

    popup: function(anchorElementOrJQ, position) {
        var anchorElement = anchorElementOrJQ instanceof jQuery ? anchorElementOrJQ : anchorElementOrJQ.$();
        this._super(anchorElement, position);
        this.set("_anchorElement", anchorElement);
        this._updateMenuSize();
    },

    _updateMenuSize: function() {
        var anchorElement = this.get("_anchorElement");
        //These values come from the CSS but we still need to know them here. Is there a better way?
        var paddingTop = 5;
        var paddingBottom = 5;
        var borderWidth = 1;
        var totalPadding = paddingTop + paddingBottom;
        var margin = this.get("menuMargin");
        var menuOuterHeight = this.get("_menuItems").get("length") * this.get("itemHeight") + totalPadding + 2 * borderWidth;
        var wh = $(window).height();
        var anchorTop = anchorElement.offset().top;
        var anchorHeight = anchorElement.outerHeight();
        var layout = this.get("layout");

        var isSubMenu = !Ember.none(this.get("parentMenu"));
        var spaceDownwards = wh - anchorTop + (isSubMenu ? (borderWidth + paddingTop) : (-anchorHeight));
        var needScrolling = false;

        if (menuOuterHeight + margin * 2 <= wh) {
            if (isSubMenu && spaceDownwards >= menuOuterHeight + margin) {
                layout.set("top", anchorTop - (borderWidth + paddingTop));
            } else if (spaceDownwards < menuOuterHeight + margin) {
                layout.set("top", wh - (menuOuterHeight + margin));
            }
        } else {
            //Constrain menu height
            menuOuterHeight = wh - 2 * margin;
            layout.set("top", margin);
            needScrolling = true;
        }
        layout.set("height", menuOuterHeight);
        this.set("layout", layout);
        this.get("contentView").set("needScrolling", needScrolling);
    },

    close: function() {
        if (this.isDestroyed) { return; }
        this.set("highlightIndex", -1);
        this._clearKeySearch();
        this._super();
    },

    /* event handling starts */
    mouseDown: function () {
        return true;
    },

    cancel: function() {
        this.close();
    },

    moveUp: function() { return this._selectNext(-1); },
    moveDown: function() { return this._selectNext(1); },

    moveRight: function() {
        this._tryOpenSubmenu(true);
        return true;
    },

    moveLeft: function() {
        var parentMenu = this.get("parentMenu");
        if (!Ember.none(parentMenu)) { parentMenu.closeCurrentlyOpenSubMenu(); }
        return true;
    },

    insertNewline: function() {
        this.makeSelection();
        return true;
    },

    keyPress: function(event) {
        var key = String.fromCharCode(event.which);
        if (event.which > 31 && key !== "") { //Skip control characters.
            this._doKeySearch(key);
            return true;
        }
        return false;
    },

    handleMouseEvents: function (event) {
        // This should probably be combined with our event handling in event_manager.
        var itemIndex = this._idToIndex(event.currentTarget.id);
        //JQuery event handling: false bubbles the stuff up.
        var retVal = false;
//        if (itemIndex === -1) { return false; }

        if (event.type === "mouseenter") {
            retVal = this.mouseEntered(itemIndex);
        } else if (event.type === "mouseup") {
            retVal = this.mouseClicked(itemIndex);
        } else if (event.type === "mousedown") {
            retVal = true;
        }
        return !retVal;
    },

    /* Event handling ends */

    mouseClicked: function(index) {
        this.set("highlightIndex", index);
        // This will currently select the item even if we're not on the the current menu. Will need to figure out how
        // to deselect an item when cursor leaves the menu totally (that is, does not move to a sub-menu).
        if (this.get('userHighlightIndex') >= 0) {
            this.makeSelection();
        }
        return true;
    },

    mouseEntered: function(index) {
        this.set("userHighlightIndex", index);
        this._tryOpenSubmenu(false);
        return true;
    },

    _selectNext: function(increment) {
        var menuItems = this.get("_menuItems");
        var len = menuItems.get("length");
        var item;
        var index = this.get("highlightIndex") + increment;
        for (; index >= 0 && index < len; index += increment) {
            item = menuItems.objectAt(index);
            if (item.isEnabled()) {
                this.set("highlightIndex", index);
                break;
            }
        }
        this._clearKeySearch();
        return true;
    },

    _valueDidChange: function() {
        var value = this.get("value");
        var valueKey = this.get("itemValueKey");
        if (!Ember.none(value) && !Ember.none(valueKey)) {
            var index = this._findIndex(function(item) {
                return Ember.get(item, valueKey) === value;
            });
            if (index >= 0) {
                this.set("highlightIndex", index);
            }
        }
    }.observes("value"),

    // Propagate internal selection to possible parent
    _internalSelectionDidChange: function() {
        var selected = this.get('internalSelection');
        Ember.trySetPath(this, "parentMenu.internalSelection", selected);
    }.observes('internalSelection'),

    _findIndex: function(identityFunc) {
        var menuItems = this.get("items");
        var i = 0, len = menuItems.get("length");
        for (; i < len; i++) {
            if (identityFunc(menuItems.objectAt(i))) {
                return i;
            }
        }
        return -1;
    },

    _findByName: function(name) {
        var re = new RegExp("^" + name, "i");
        var titleKey = this.get("itemTitleKey");
        return this._findIndex(function(menuItem) {
            return re.test(Ember.get(menuItem, titleKey));
        });
    },

    _toggleClass: function(className, index, addOrRemove) {
        var menuItem = this.get("_menuItems").objectAt(index);
        menuItem.elementSelector().toggleClass(className, addOrRemove);
    },

    _highlightWillChange: function() {
        var index = this.get("highlightIndex");
        var lastItem = this.get("_menuItems").objectAt(index);
        if (!Ember.none(lastItem)) {
            this._toggleClass("is-selected", index);
            lastItem.isSelected = false;
            lastItem.closeSubMenu();
        }
    }.observesBefore("highlightIndex"),

    _highlightDidChange: function() {
        var index = this.get("highlightIndex");
        var newItem = this.get("_menuItems").objectAt(index);
        var internalSelection;
        if (!Ember.none(newItem)) {
            this._toggleClass("is-selected", index);
            newItem.isSelected = true;
            if (newItem.isSelectable()) {
                internalSelection = newItem.item;
            }
        }
        this.set('internalSelection', internalSelection);

    }.observes("highlightIndex"),

    /** We only want to allow selecting menu items after the user has moved the mouse. We update
        userHighlightIndex when user highlights something, and internally we use highlightIndex to keep
        track of which item is highlighted, only allowing selection if user has highlighted something.
        If we don't ensure the user has highlighted something before allowing selection, this means that when
        a user clicks a SelectViewButton to open a menu, the mouseUp event (following the mouseDown on the select)
        would be triggered on a menu item, and this would cause the menu to close immediately.
         **/
    _userHighlightIndexDidChange: function() {
        this.set('highlightIndex', this.get('userHighlightIndex'));
    }.observes("userHighlightIndex"),

    _clearKeySearch: function() {
        if (!Ember.none(this._timer)) {
            Ember.run.cancel(this._timer);
        }
        this._searchKey = "";
    },

    _doKeySearch: function(key) {
        this._searchKey = (this._searchKey || "") + key;
        var index = this._findByName(this._searchKey);
        if (index >= 0) {
            this.set("highlightIndex", index);
        }

        if (!Ember.none(this._timer)) {
            Ember.run.cancel(this._timer);
        }
        this._timer = Ember.run.later(this, this._clearKeySearch, 1000);
    },

    _indexToId: function(index) {
        return "%@-%@".fmt(this.get("elementId"), index);
    },

    _idToIndex: function(id) {
        var re = new RegExp("%@-(\\d+)".fmt(this.get("elementId")));
        var res = re.exec(id);
        return res && res.length === 2 ? parseInt(res[1], 10) : -1;
    },

    _tryOpenSubmenu: function (selectItem) {
        var index = this.get("highlightIndex");
        var item = this.get("_menuItems").objectAt(index);
        var subMenuItems = item.subMenuItems;
        if (!Ember.none(subMenuItems) && item.isEnabled() && subMenuItems.get("length") > 0) {
            this._clearKeySearch();
            var subMenu = item.subMenuView;
            if (Ember.none(subMenu)) {
                subMenu = this.createSubMenu(subMenuItems);
                item.subMenuView = subMenu;
            }
            subMenu.popup(item.elementSelector(), Flame.POSITION_RIGHT);
            if (selectItem) { subMenu._selectNext(1); }
            return true;
        }
        return false;
    },

    didInsertElement: function() {
        this._super();
        var self = this;
        var id = this.get("elementId");
        var events = "mouseenter.%@ mouseup.%@ mousedown.%@".fmt(id, id, id);
        Ember.$("#%@".fmt(id)).on(events, ".flame-menu-item-view", function(event) {
            return self.handleMouseEvents(event);
        });
    }

});
/**
  Flame.Popover provides a means to display a popup in the context of an existing element in the UI.
*/

Flame.Popover = Flame.Panel.extend({
    classNames: ['flame-popover'],
    childViews: [],
    dimBackground: false,
    arrow: 'arrow', // How to use a string literal in bindAttr?
    handlebars: '<img {{bindAttr class="arrowPosition arrow"}} {{bindAttr src="image"}} />{{view contentView}}',
    anchor: null,
    position: null,

    _positionArrow: function() {
        var anchor = this.get('anchor');
        var position = this.get('position');
        var offset = anchor.offset();
        var arrowOffset;
        if (position & (Flame.POSITION_ABOVE | Flame.POSITION_BELOW)) {
            arrowOffset = offset.left + (anchor.outerWidth() / 2) - parseInt(this.$().css('left').replace('px', ''), 10) - 15;
            this.$('img.arrow').css({ left: arrowOffset + 'px' });
        } else {
            arrowOffset = offset.top + (anchor.outerHeight() / 2) - parseInt(this.$().css('top').replace('px', ''), 10) - 15;
            this.$('img.arrow').css({ top: arrowOffset + 'px' });
        }
    },

    _layoutRelativeTo: function(anchor, position) {
        anchor = anchor instanceof jQuery ? anchor : anchor.$();
        this.set('anchor', anchor);
        this.set('position', position);
        var layout = this._super(anchor, position);
        if (position & Flame.POSITION_ABOVE) {
            layout.top -= 15;
            this.set('arrowPosition', 'above');
            this.set('image', Flame.image('arrow_down.png'));
        } else if (position & Flame.POSITION_BELOW) {
            layout.top += 15;
            this.set('arrowPosition', 'below');
            this.set('image', Flame.image('arrow_up.png'));
        } else if (position & Flame.POSITION_LEFT) {
            layout.right += 15;
            this.set('arrowPosition', 'left');
            this.set('image', Flame.image('arrow_right.png'));
        } else if (position & Flame.POSITION_RIGHT) {
            layout.left += 15;
            this.set('arrowPosition', 'right');
            this.set('image', Flame.image('arrow_left.png'));
        }
        return layout;
    },

    didInsertElement: function() {
        this._positionArrow();
    },

    popup: function(anchor, position) {
        ember_assert('Flame.Popover.popup requires an anchor', !!anchor);
        ember_assert('Flame.Popover.popup requires a position', !!position);
        this._super(anchor, position | Flame.POSITION_MIDDLE);
    }
});

Flame.ProgressView = Flame.View.extend({
    classNames: ['flame-progress-view'],
    animate: false,

    handlebars: function() {
        var height = this.get('layout').height;
        return "<div style='height: %@px;' class='progress-container'></div><div style='height: %@px; width: %@px;' class='progress-bar'></div>".fmt(height - 2, height - 4, this.get('size'));
    }.property().cacheable(),

    size: function() {
        var progress = this.get('value') / this.get('maximum');
        if (isNaN(progress)) {
            return 0;
        } else {
            var width = this.get('layout').width;
            if (progress > 1) progress = 1;
            return Math.floor(width * progress) - 4;
        }
    }.property('value', 'maximum'),

    _sizeDidChange: function() {
        // In CubeTableLoadingView, the progress views are rendered before the value & maximum bindings have synchronized,
        // which means the handlebars template uses width 0. Then they synchronize _before_ the element is added to DOM,
        // which means $(...) doesn't work yet. Defer updating to next runloop.
        Ember.run.next(this, function() {
            if (this.get('animate')) {
                this.$('.progress-bar').animate({ width: this.get('size') }, 300);
            } else {
                this.$('.progress-bar').css('width', this.get('size'));
            }
        });
    }.observes('size')
});
Flame.RadioButtonView = Flame.CheckboxView.extend({
    classNames: ['flame-radio-button-view'],

    action: function() {
        this.set('targetValue', this.get('value'));
    },

    isSelected: function() {
        if (Ember.typeOf(this.get('value')) === 'undefined' || Ember.typeOf(this.get('targetValue')) === 'undefined') {
            return false;
        }
        return this.get('value') === this.get('targetValue');
    }.property('targetValue', 'value').cacheable(),

    renderCheckMark: function(context) {
        context.push("<div class='flame-view flame-checkbox-checkmark' style='top:8px;left:8px;width:6px;height:6px;'></div>");
    }
});
/**
  The actual text field is wrapped in another view since browsers like Firefox
  and IE don't support setting the `right` CSS property (used by LayoutSupport)
  on input fields.
 */

Flame.TextFieldView = Flame.View.extend(Flame.ActionSupport, {
    classNames: ['flame-text'],
    childViews: ['textField'],

    layout: { left: 0, top: 0 },
    defaultHeight: 22,
    defaultWidth: 200,

    value: '',
    placeholder: null,
    isPassword: false,
    isValid: null,
    isEditableLabel: false,
    isVisible: true,

    becomeKeyResponder: function() {
        this.get('textField').becomeKeyResponder();
    },

    insertNewline: function() {
        return this.fireAction();
    },

    textField: Ember.TextField.extend(Flame.EventManager, Flame.FocusSupport, {
        classNameBindings: ['isInvalid', 'isEditableLabel', 'isFocused'],
        acceptsKeyResponder: true,
        typeBinding: Ember.Binding.from('^isPassword').transformTrueFalse('password', 'text'),
        isInvalidBinding: Ember.Binding.from('^isValid').transform(function(v) {
            return v === false;
        }).oneWay(),
        valueBinding: '^value',
        placeholderBinding: '^placeholder',
        isEditableLabelBinding: '^isEditableLabel',
        isVisibleBinding: '^isVisible',

        // Ember.TextSupport (which is mixed in by Ember.TextField) calls interpretKeyEvents on keyUp.
        // Since the event manager already calls interpretKeyEvents on keyDown, the action would be fired
        // twice, both on keyDown and keyUp. So we override the keyUp method and only record the value change.
        keyUp: function() {
            this._elementValueDidChange();
            return false;
        },

        insertNewline: function() { return false; },
        cancel: function() { return false; },

        // The problem here is that we need browser's default handling for these events to make the input field
        // work. If we had no handlers here and no parent/ancestor view has a handler returning true, it would
        // all work. But if any ancestor had a handler returning true, the input field would break, because
        // true return value signals jQuery to cancel browser's default handling. It cannot be remedied by
        // returning true here, because that has the same effect, thus we need a special return value (which
        // Flame.EventManager handles specially by stopping the parent propagation).
        mouseDown: function() { return Flame.ALLOW_BROWSER_DEFAULT_HANDLING; },
        mouseMove: function() { return Flame.ALLOW_BROWSER_DEFAULT_HANDLING; },
        mouseUp: function() { return Flame.ALLOW_BROWSER_DEFAULT_HANDLING; }
    })
});


Flame.SearchTextFieldView = Flame.TextFieldView.extend({
    classNames: ['flame-search-field'],

    cancel: function() {
        if (Ember.empty(this.get('value'))) {
            // Nothing to clear, we don't handle the event
            return false;
        } else {
            // I don't know why, but for this to work in Firefox we need to run
            // it in the next run loop.
            Ember.run.next(this, function() {
                this.set('value', '');
            });
            return true;
        }
    }
});

Flame.SelectButtonView = Flame.ButtonView.extend({
    classNames: ['flame-select-button-view'],
    items: [],
    value: undefined,
    defaultHeight: 22,
    itemTitleKey: 'title',
    itemValueKey: 'value',
    itemActionKey: 'action',
    subMenuKey: "subMenu",

    handlebars: function() {
        return '<label>{{_selectedMenuItem.%@}}</label><div><img src="%@"></div>'.fmt(this.get("itemTitleKey"), Flame.image('select_button_arrow.png'));
    }.property("value", "_selectedMenuItem").cacheable(),

    _selectedMenuItem: function() {
        if (this.get('value') === undefined) { return undefined; }
        var selectedItem = this._findItem();
        return selectedItem;
    }.property("value", "itemValueKey", "subMenuKey", "items").cacheable(),

    itemsDidChange: function() {
        if (this.get('items') && this.getPath('items.length') > 0 && !this._findItem()) {
            this.set('value', this.getPath('items.firstObject.%@'.fmt(this.get('itemValueKey'))));
        }
    }.observes('items'),

    _findItem: function(itemList) {
        if (!itemList) itemList = this.get('items');
        var itemValueKey = this.get('itemValueKey'),
            value = this.get('value'),
            subMenuKey = this.get('subMenuKey'),
            foundItem;
        if (Ember.none(itemList)) { return foundItem; }
        itemList.forEach(function(item) {
            if (Ember.get(item, subMenuKey)) {
                var possiblyFound = this._findItem(Ember.get(item, subMenuKey));
                if (!Ember.none(possiblyFound)) { foundItem = possiblyFound; }
            } else if (Ember.get(item, itemValueKey) === value) {
                foundItem = item;
            }
        }, this);
        return foundItem;
    },

    menu: function() {
        // This has to be created dynamically to set the selectButtonView reference (parentView does not work
        // because a menu is added on the top level of the view hierarchy, not as a children of this view)
        var self = this;
        return Flame.MenuView.extend({
            selectButtonView: this,
            itemTitleKey: this.get('itemTitleKey'),
            itemValueKey: this.get('itemValueKey'),
            itemActionKey: this.get('itemActionKey'),
            subMenuKey: this.get('subMenuKey'),
            itemsBinding: 'selectButtonView.items',
            valueBinding: 'selectButtonView.value',
            close: function() {
                self.gotoState('idle');
                this._super();
            }
        });
    }.property(),

    mouseDown: function() {
        this._openMenu();
        return false;
    },

    insertSpace: function() {
        this._openMenu();
        return true;
    },

    _openMenu: function() {
        this.gotoState('mouseDownInside');
        this.get('menu').create().popup(this);
    }
});

Flame.StackItemView = Flame.ListItemView.extend({
    useAbsolutePosition: true,
    classNames: ['flame-stack-item-view']
});

// Stack view is a list view that grows with the content and uses absolute positioning for the child views.
// Use class StackItemView as the superclass for the item views.
Flame.StackView = Flame.ListView.extend({
    layoutManager: Flame.VerticalStackLayoutManager.create({ topMargin: 0, spacing: 0, bottomMargin: 0 }),
    allowSelection: false
});
Flame.StackedView = Flame.View.extend({
    // TODO
});
Flame.TabView = Flame.View.extend({
    classNames: ['flame-tab-view'],
    childViews: 'tabBarView contentView'.w(),
    tabs: null,
    previousTabs: null,
    nowShowing: null,
    tabsHeight: 23,
    initializeTabsLazily: true,

    init: function() {
        this._super();
        //if tabs not set via binding, we need to build the tabs here
        if (!Ember.none(this.get('tabs'))) {
            this._tabsDidChange();
        }
    },

    _tabsWillChange: function() {
        var tabs = this.get('tabs');
        if (!Ember.none(tabs)) {
            this.set('previousTabs', tabs.slice());
        }
    }.observesBefore('tabs.@each'),

    _tabsDidChange: function() {
        var tabs = this.get('tabs');
        if (Ember.none(tabs)) {
            return;
        }
        var previousTabs = this.get('previousTabs');

        if (!Ember.none(previousTabs)) {
            previousTabs.forEach(function(tab, i) {
                if (Ember.none(tabs.findProperty('value', tab.value))) {
                    var tabBarView = this.get('tabBarView');
                    tabBarView.get('childViews').forEach(function(tabView) {
                        if (tabView.get('value') === tab.value) tabBarView.removeChild(tabView);
                    });
                }
            }, this);
        }

        tabs.forEach(function(tab, i) {
            if (Ember.none(previousTabs) || Ember.none(previousTabs.findProperty('value', tab.value))) {
                this._addTab(tab, i);
            }
        }, this);
    }.observes('tabs.@each'),

    _addTab: function(tab, index) {
          var contentView = this.get('contentView');
          var contentViewChildren = contentView.get('childViews');
          var tabBarView = this.get('tabBarView');
          var tabBarViewChildren = tabBarView.get('childViews');
          var tabsHeight = this.get('tabsHeight');
          var self = this;
          tabBarViewChildren.insertAt(index, tabBarView.createChildView(Flame.ButtonView.create({
              acceptsKeyResponder: false,
              layout: { top: 0, bottom: 0, height: tabsHeight },
              title: tab.title,
              value: tab.value,
              isSelectedBinding: Ember.Binding.from('parentView.parentView.nowShowing').eq(tab.value),
              action: function() {
                  self.set('nowShowing', tab.value);
              }
          })));
          var view = self.get(tab.value);
          ember_assert('View for tab %@ not defined!'.fmt(tab.value), !!view);
          if (!self.get('initializeTabsLazily')) {
              if (!(view instanceof Ember.View)) {
                  view = contentView.createChildView(view);
              }
              view.set('isVisible', false);
              contentViewChildren.addObject(view);
              self.set(tab.value, view);
          }

          if (Ember.none(this.get('nowShowing'))) this.set('nowShowing', this.get('tabs').objectAt(0).value);
      },

    _tabWillChange: function() {
        if (this.get('nowShowing')) {
            this.get(this.get('nowShowing')).set('isVisible', false);
        }
    }.observesBefore('nowShowing'),

    _tabDidChange: function() {
        if (this.get('nowShowing')) {
            var nowShowing = this.get('nowShowing');
            var view = this.get(nowShowing);
            if (!(view instanceof Ember.View)) {
                var contentView = this.get('contentView');
                view = contentView.createChildView(view);
                contentView.get('childViews').addObject(view);
                this.set(nowShowing, view);
            }
            view.set('isVisible', true);
        }
    }.observes('nowShowing'),

    tabBarView: Flame.View.extend({
        classNames: ['flame-tab-view-tabs'],
        layout: { left: 0, top: 0, right: 0, height: 'parentView.tabsHeight' }
    }),

    contentView: Flame.View.extend({
        classNames: ['flame-tab-view-content'],
        layout: { left: 0, top: 'parentView.tabsHeight', right: 0, bottom: 0 }
    })

});
Flame.TableDataView = Flame.View.extend(Flame.Statechart, {
    classNames: ['flame-table-data-view'],
    acceptsKeyResponder: true,
    updateBatchSize: 500,
    _updateCounter: 0,
    selectedCell: null,
    editValue: null,

    initialState: 'loaded',

    loaded: Flame.State.extend({
        mouseDown: function(event) {
            if (this.get('owner').selectCell(jQuery(event.target))) {
                this.gotoState('selected');
                return true;
            } else { return false; }
        },

        enterState: function() {
            if (this.getPath('owner.state') === "inDOM") {
                this.getPath('owner.selection').hide();
            }
        }
    }),

    selected: Flame.State.extend({
        mouseDown: function(event) {
            var target = jQuery(event.target);
            // If a cell is clicked that was already selected, start editing it
            if (target.hasClass('table-selection') && this.getPath('owner.selectedDataCell.options')) {
                this.startEdit();
                return true;
            } else return !!this.get('owner').selectCell(target);
        },

        insertNewline: function(event) {
            return this.startEdit();
        },

        deleteBackward: function(event) {
            this.wipeCell();
            return true;
        },

        deleteForward: function(event) {
            this.wipeCell();
        },

        wipeCell: function() {
            var dataCell = this.getPath('owner.selectedDataCell');
            if (Ember.none(dataCell)) {
                return;
            }

            if (dataCell.isEditable()) {
                this.get('owner')._validateAndSet("");
            }
        },

        doubleClick: function() {
            this.startEdit();
        },

        startEdit: function(event) {
            var dataCell = this.getPath('owner.selectedDataCell');
            if (Ember.none(dataCell)) {
                return;
            }
            if (dataCell.isEditable()) {
                this.gotoState('editing');
            } else if (!dataCell.options()) {
                this.gotoState('selectingReadOnly');
            }
        },

        cancel: function(event) {
            this.get('owner').resignKeyResponder();
            return true;
        },

        moveLeft: function(event) {
            var selectedCell = this.getPath('owner.selectedCell');
            this.get('owner').selectCell(selectedCell.prev());
            return true;
        },

        moveRight: function(event) {
            var selectedCell = this.getPath('owner.selectedCell');
            this.get('owner').selectCell(selectedCell.next());
            return true;
        },

        moveDown: function(event) {
            var selectedCell = this.getPath('owner.selectedCell');
            this.get('owner').selectCell(jQuery(selectedCell.parent().next().children()[selectedCell.attr('data-index')]));
            return true;
        },

        moveUp: function(event) {
            var selectedCell = this.getPath('owner.selectedCell');
            this.get('owner').selectCell(jQuery(selectedCell.parent().prev().children()[selectedCell.attr('data-index')]));
            return true;
        },

        insertTab: function(event) {
            this.get('owner').invokeStateMethodByValuesOn('moveDown', 'moveRight');
            return true;
        },

        insertBacktab: function(event) {
            this.get('owner').invokeStateMethodByValuesOn('moveUp', 'moveLeft');
            return true;
        },

        // We need to use the keyPress event, as some browsers don't report the character pressed correctly with keyDown
        keyPress: function(event) {
            var dataCell = this.getPath('owner.selectedDataCell');
            if (!dataCell.isEditable()) {
                return false;
            }
            var key = String.fromCharCode(event.which);
            if (event.metaKey) { return false; }
            if (key.match(/[a-zA-Z0-9+*\-\[\/\=]/)) {
                var owner = this.get('owner');
                owner.set('editValue', '');
                this.startEdit();
                return true;
            }
            return false;
        },

        enterState: function() {
            this.getPath('owner.selection').show();
        }
    }),

    // Used to allow users to select text from read-only cells
    selectingReadOnly: Flame.State.extend({
        keyPress: function(event) {
            return true;
        },

        cancel: function(event) {
            this.get('owner')._cancelEditingOrSelecting();
            return true;
        },

        insertNewline: function(event) {
            var owner = this.get('owner');
            this.gotoState('selected');
            owner.invokeStateMethodByValuesOn('moveRight', 'moveDown');
        },

        moveLeft: function(event) {
            this._invokeInSelected('moveLeft');
        },

        moveRight: function(event) {
            this._invokeInSelected('moveRight');
        },

        moveDown: function(event) {
            this._invokeInSelected('moveDown');
        },

        moveUp: function(event) {
            this._invokeInSelected('moveUp');
        },

        insertTab: function(event) {
            this._invokeInSelected('insertTab');
        },

        insertBacktab: function(event) {
            this._invokeInSelected('insertBacktab');
        },

        deleteBackward: function(event) {
            this.gotoState('selected');
            return true;
        },

        mouseDown: function(event) {
            var owner = this.get('owner');
            var cell = jQuery(event.target);
            if (owner.isCellSelectable(cell)) {
                this.gotoState('selected');
                owner.selectCell(cell);
                return true;
            } else {
                return false;
            }
        },

        enterState: function() {
            var owner = this.get('owner');
            var selection = owner.get('selection');
            var dataCell = owner.get('selectedDataCell');
            var readOnlyValue = owner.editableValue(dataCell);
            selection.html(readOnlyValue);
            selection.addClass('read-only');
        },

        exitState: function() {
            var selection = this.getPath('owner.selection');
            selection.html('');
            selection.removeClass('read-only');
        },

        _invokeInSelected: function(action) {
            var owner = this.get('owner');
            this.gotoState('selected');
            owner.invokeStateMethod(action);
        }
    }),

    editing: Flame.State.extend({
        cancel: function(event) {
            this.get('owner')._cancelEditingOrSelecting();
            return true;
        },

        insertNewline: function(event) {
            var owner = this.get('owner');
            if (owner._confirmEdit()) {
                this.gotoState('selected');
                owner.invokeStateMethodByValuesOn('moveRight', 'moveDown');
            }
            return true;
        },

        insertTab: function(event) {
            var owner = this.get('owner');
            if (owner._confirmEdit()) {
                this.gotoState('selected');
                owner.invokeStateMethod('insertTab');
            }
            return true;
        },

        insertBacktab: function(event) {
            var owner = this.get('owner');
            if (owner._confirmEdit()) {
                this.gotoState('selected');
                owner.invokeStateMethod('insertBacktab');
            }
            return true;
        },

        mouseDown: function(event) {
            var owner = this.get('owner');
            var cell = jQuery(event.target);
            if (owner.isCellSelectable(cell) && owner._confirmEdit()) {
                this.gotoState('selected');
                owner.selectCell(cell);
                return true;
            } else { return false; }
        },

        enterState: function() {
            var owner = this.get('owner');
            var selectedCell = owner.get('selectedCell');
            var position = selectedCell.position();
            var dataCell = owner.get('selectedDataCell');
            var editCell = owner.get('editField');
            var scrollable = owner.getPath('parentView.scrollable');
            var selection = owner.get('selection');
            var options = dataCell.options();

            if (options) { // Drop down menu for fields with a fixed set of options
                var menu = Flame.MenuView.create({
                    layout: { width: 220 },
                    parent: owner, // Reference to the cube table view
                    items: options.map(function(o) {
                        return {
                            title: o[0],
                            value: o[1],
                            isChecked: o[1] === dataCell.value,
                            action: function() { owner.didSelectMenuItem(this.get('value')); }
                        };
                    }),
                    // Make the cube table view go back to the selected state when the menu is closed
                    close: function() { this.get('parent').gotoState('selected'); this._super(); }});
                menu.popup(selectedCell);
            } else { // Normal edit field for everything else
                var backgroundColor = selectedCell.css('backgroundColor');

                // If background color is unset, it defaults to transparent. Different browser have different
                // ways of saying "transparent". Let's assume "transparent" actually means "white".
                if (['rgba(0, 0, 0, 0)', 'transparent'].contains(backgroundColor)) {
                    backgroundColor = 'white';
                }

                editCell.css({
                    left: parseInt(selection.css('left'), 10) + parseInt(selection.css('border-left-width'), 10) + 'px',
                    top: parseInt(selection.css('top'), 10) + parseInt(selection.css('border-top-width'), 10) + 'px',
                    width: selection.outerWidth() - parseInt(selection.css('border-left-width'), 10) - parseInt(selection.css('border-right-width'), 10) + 'px',
                    height: selection.outerHeight() - parseInt(selection.css('border-top-width'), 10) - parseInt(selection.css('border-bottom-width'), 10) + 'px',
                    backgroundColor: backgroundColor
                });
                var editValue = owner.editableValue(dataCell);

                editCell.val(editValue);
                owner.set('editValue', null);
                editCell.show();
                // Put cursor at end of value
                editCell.selectRange(1024, 1024);
            }
        },

        exitState: function() {
            var owner = this.get('owner');
            var editField = owner.get('editField');

            editField.hide();
            editField.removeClass('invalid');
        }
    }),

    didSelectMenuItem: function(value) {
        var editField = this.getPath('editField');
        editField.val(value || '');
        this._confirmEdit();
        this.invokeStateMethodByValuesOn('moveRight', 'moveDown');
    },

    willLoseKeyResponder: function() {
        this.set('selectedCell', null);
        this.gotoState('loaded');
    },

    // Get the Cell instance that corresponds to the selected cell in the view
    selectedDataCell: function() {
        var selectedCell = this.get('selectedCell');
        return this.get('data')[selectedCell.parent().attr('data-index')][selectedCell.attr('data-index')];
    }.property(),

    editableValue: function(dataCell) {
        var editValue = this.get('editValue');
        if (editValue !== null) {
            return editValue;
        } else {
            editValue = dataCell.editableValue();
            return !Ember.none(editValue)? editValue : '';
        }
    },

    didInsertElement: function() {
        this.set('selection', this.$('.table-selection'));
        this.set('editField', this.$('.table-edit-field'));
    },

    _selectionDidChange: function() {
        var selectedCell = this.get('selectedCell');
        if (!selectedCell) {
            return;
        }
        var selection = this.get('selection');
        var scrollable = this.getPath('parentView.scrollable');
        var dataCell = this.get('selectedDataCell');

        var position = selectedCell.position();
        var scrollTop = scrollable.scrollTop();
        var scrollLeft = scrollable.scrollLeft();

        var offset = jQuery.browser.webkit ? 1 : 2;
        selection.css({
            left: position.left + scrollLeft - offset + 'px',
            top: position.top + scrollTop - offset + 'px',
            width: selectedCell.outerWidth() - 3 + 'px',
            height: selectedCell.outerHeight() - 1 + 'px'
        });

        // Ensure the selection is within the visible area of the scrollview
        if (position.top < 0) {
            scrollable.scrollTop(scrollTop + position.top);
        } else if (position.top + selectedCell.outerHeight() > scrollable.outerHeight()) {
            var top = position.top + selectedCell.outerHeight() - scrollable.outerHeight();
            scrollable.scrollTop(top + scrollTop + 17);
        } else if (position.left < 0) {
            scrollable.scrollLeft(scrollLeft + position.left);
        } else if (position.left + selectedCell.outerWidth() > scrollable.outerWidth()) {
            var left = position.left + selectedCell.outerWidth() - scrollable.outerWidth();
            scrollable.scrollLeft(left + scrollLeft + 17);
        }
    }.observes('selectedCell'),

    _confirmEdit: function() {
        var newValue = this.get('editField').val();
        return this._validateAndSet(newValue);
    },

    // Returns true if cell valid, or false otherwise
    _validateAndSet: function(newValue) {
        var data = this.get('data');
        var selectedCell = this.get('selectedCell');
        var columnIndex = parseInt(selectedCell.attr('data-index'), 10);
        var rowIndex = parseInt(selectedCell.parent().attr('data-index'), 10);
        var dataCell = data[rowIndex][columnIndex];

        // Skip saving if value has not been changed
        if (dataCell.editableValue() === newValue) {
            return true;
        } else if (dataCell.validate(newValue)) {
            var cellUpdateDelegate = this.get('cellUpdateDelegate');
            ember_assert('No cellUpdateDelegate set!', !!cellUpdateDelegate);

            var index = [rowIndex, columnIndex];
            if (cellUpdateDelegate.cellUpdated(dataCell, newValue, index)) {
                var dirtyCells = this.get('dirtyCells').slice();
                dirtyCells.push([rowIndex, columnIndex]);
                this.set('dirtyCells', dirtyCells);
            }

            return true;
        } else {
            this.get('editField').addClass('invalid');
            return false;
        }
    },

    _cancelEditingOrSelecting: function() {
        this.gotoState('selected');
    },

    invokeStateMethodByValuesOn: function(onRowsState, onColumnsState) {
        if (this.get('areValuesOnRows')) {
            this.invokeStateMethod(onRowsState);
        } else {
            this.invokeStateMethod(onColumnsState);
        }
    },

    selectCell: function(newSelection) {
        // TODO click can also come from element in a table cell
        if (this.getPath('parentView.allowSelection') && this.isCellSelectable(newSelection)) {
            this.set('selectedCell', newSelection);
            return true;
        }
        return false;
    },

    isCellSelectable: function(cell) {
        return cell && cell[0] && cell[0].nodeName === 'TD';
    },

    keyPress: function(event) {
        if (this.interpretKeyEvents(event)) {
            return true;
        } else {
            this.invokeStateMethod('keyPress', event);
            return false;
        }
    },

    updateColumnWidth: function(index, width) {
        var cells = this.$('td[data-index=%@]'.fmt(index));
        cells.css({'width': '%@px'.fmt(width)});
        this.propertyDidChange('selectedCell'); // Let the size of the selection div be updated
    },

    render: function(buffer) {
        this._renderElementAttributes(buffer);
        this.set('selectedCell', null);
        this.gotoState('loaded');
        this._renderTable(buffer);
    },

    _renderTable: function(buffer) {
        var data = this.get('data');
        if (!data) { return buffer; }
        var rowCount = data.length;
        if (!data[0]) {
            return buffer;
        }
        var columnCount = data[0].length;
        var defaultCellWidth = this.getPath('parentView.defaultColumnWidth');
        var columnLeafs = this.getPath('parentView.content.columnLeafs');
        var cellWidth;

        var classes = 'flame-table';
        if (!this.getPath('parentView.allowSelection')) { classes += ' is-selectable'; }
        buffer = buffer.begin('table').attr('class', classes).attr('width', '1px');
        var i, j;
        for (i = 0; i < rowCount; i++) {
            buffer.push('<tr data-index="'+i+'">');
            for (j = 0; j < columnCount; j++) {
                var cell = data[i][j];
                var cssClassesString = cell ? cell.cssClassesString() : "";
                cellWidth = columnLeafs[j].get('render_width') || defaultCellWidth;
                if (jQuery.browser.mozilla) cellWidth -= 5;

                buffer.push('<td data-index="%@" class="%@" style="width: %@px;">%@</td>'.fmt(
                        j,
                        (cssClassesString + (j % 2 === 0 ? " even-col" : " odd-col")),
                        cellWidth,
                        (cell ? cell.formattedValue() : '<span style="color: #999">...</span>')));
            }
            buffer.push("</tr>");
        }
        buffer = buffer.end(); // table

        // Selection indicator
        buffer = buffer.begin('div').attr('class', 'table-selection').end();

        // Edit field (text)
        buffer = buffer.begin('input').attr('class', 'table-edit-field').end();
    },

    // Update dirty cells
    _cellsDidChange: function() {
        this.manipulateCells(this.get('dirtyCells'), function(cell, element, isEvenColumn) {
            var cssClassesString = (cell ? cell.cssClassesString() : "") + (isEvenColumn ? " even-col" : " odd-col");
            var formattedValue = cell.formattedValue();
            element.className = cssClassesString;
            element.innerHTML = Ember.none(formattedValue) ? "" : formattedValue;
        }, ++this._updateCounter);
    }.observes('dirtyCells'),

    // Mark and disable updating cells
    _updatingCellsDidChange: function() {
        this.manipulateCells(this.get('cellsMarkedForUpdate'), function(cell, element, isEvenColumn) {
            cell.isUpdating = true;
            var cssClassesString = cell.cssClassesString() + (isEvenColumn ? " even-col" : " odd-col");
            element.className = cssClassesString;
        });
    }.observes('cellsMarkedForUpdate'),

    manipulateCells: function(cellRefs, callback, updateCounter) {
        var data = this.get('data');
        if (!cellRefs || cellRefs.length === 0) { return; }
        var table = this.$('table.flame-table');

        var allCells = table.find('td');
        // Everyone expects that the cellRefs array is empty when we return from this function. We still need the
        // content so save it elsewhere.
        var content = cellRefs.splice(0, cellRefs.length);
        this._batchUpdate(this.get("updateBatchSize"), 0, updateCounter, content, data, allCells, callback);
    },

    _batchUpdate: function(maxUpdates, startIx, updateCounter, cellRefs, data, allCells, callback) {
        if (typeof updateCounter !== "undefined" && updateCounter != this._updateCounter) { return; }
        // If we for some reason update / change the table before all these calls have gone through, we may update
        // nodes that no longer exist in DOM but that shouldn't cause problems.
        var len = cellRefs.length;
        var element, index, cell;
        var columnLength = data[0].length;

        for (var i = startIx; i < len && (i - startIx) < maxUpdates; i++) {
            index = cellRefs[i];
            var x = index[0], y = index[1];
            cell = data[x][y];
            element = allCells[x * columnLength + y];
            if (element) {
                callback(cell, element, y % 2 === 0);
            }
        }
        if (i < len) {
            // We've still got some updating to do so let's do it in the next run loop. Thus we should not get any slow
            // script errors but that doesn't mean that the interface is responsive at any degree.
            var self = this;
            Ember.run.next(function() {
                self._batchUpdate(maxUpdates, i, updateCounter, cellRefs, data, allCells, callback);
            });
        }
    }

});

Flame.TableView = Flame.View.extend(Flame.Statechart, {
    classNames: 'flame-table-view'.w(),
    childViews: 'tableDataView'.w(),
    acceptsKeyResponder: false,

    // References to DOM elements
    scrollable: null, // the scrollable div that holds the data table
    rowHeader: null, // the row header table element
    columnHeader: null, // the column header table element
    tableCorner: null,

    isSimpleTable: false,
    isRowHeaderClickable: true,
    isResizable: true,
    allowSelection: false,

    initialState: 'idle',

    defaultColumnWidth: 88,
    cellUpdateDelegate: null,
    clickDelegate: null,
    resizeDelegate: null,
    content: null,  // Set to a Flame.TableController
    allowRefresh: true,

    contentAdapter: function() {
        return Flame.TableViewContentAdapter.create({
            content: this.get('content')
        });
    }.property('content').cacheable(),

    tableDataView: Flame.TableDataView.extend({
        dataBinding: '^content._data',
        dirtyCellsBinding: '^content.dirtyCells',
        areValuesOnRowsBinding: '^content.areValuesOnRows',
        totalRowIdsBinding: '^content.totalRowIds',
        totalColumnIdsBinding: '^content.totalColumnIds',
        cellUpdateDelegateBinding: '^cellUpdateDelegate',
        allowRefreshBinding: '^allowRefresh',
        cellsMarkedForUpdateBinding: '^content.cellsMarkedForUpdate',
        _cellsDidChange: function() {
            if (this.get('allowRefresh')) {
                this._super();
            }
        }.observes('dirtyCells', 'allowRefresh')
    }),

    rowDepth: function() {
        return this.getPath('contentAdapter.rowHeaderRows').map(function(a) {
            return a.length;
        }).max();
    }.property('contentAdapter.rowHeaderRows').cacheable(),

    idle: Flame.State.extend({
        mouseDown: function(event) {
            var target = jQuery(event.target);
            if (target.is('div.resize-handle')) {
                this.gotoState('resizing');
                var owner = this.get('owner');
                var cell = target.parent();
                owner.set('resizingCell', cell);
                owner.set('dragStartX', event.pageX);
                owner.set('startX', parseInt(target.parent().css('width'), 10));
                owner.set('offset', parseInt(this.getPath('owner.tableCorner').css('width'), 10));
                owner.set('type', cell.is('.column-header td') ? 'column' : 'row');
                return true;
            } else if (!!target.closest('.column-header').length) {
                return true;
            } else if (target.is('a')) {
                return true;
            }

            return false;
        },

        mouseUp: function(event) {
            var clickDelegate = this.getPath('owner.clickDelegate');
            if (clickDelegate) {
                var target = jQuery(event.target), index, header;
                if (!!target.closest('.column-header').length && (index = target.closest('td').attr('data-leaf-index'))) {
                    if (clickDelegate.columnHeaderClicked) {
                        header = this.getPath('owner.content.columnLeafs')[index];
                        clickDelegate.columnHeaderClicked(header, target);
                    }
                    return true;
                } else if (!!target.closest('.row-header').length) {
                    if (clickDelegate.rowHeaderClicked) {
                        var cell = target.closest('td');
                        index = parseInt(cell.attr('data-index'), 10) / parseInt(cell.attr('rowspan') || 1, 10);
                        header = this.getPath('owner.content._headers.rowHeaders')[index];
                        if (!header) { return false; }
                        clickDelegate.rowHeaderClicked(header, target, index);
                    }
                    return true;
                }
            }

            return false;
        }
    }),

    resizing: Flame.State.extend({
        mouseMove: function(event) {
            var target = jQuery(event.target);
            var cell = this.getPath('owner.resizingCell');
            var deltaX = event.pageX - this.getPath('owner.dragStartX');
            var cellWidth = this.getPath('owner.startX') + deltaX;
            if (cellWidth < 30) { cellWidth = 30; }
            var leafIndex;
            // Adjust size of the cell
            if (this.getPath('owner.type') === 'column') { // Update data table column width
                leafIndex = parseInt(cell.attr('data-leaf-index'), 10) + 1;
                cell.parents('table').find('colgroup :nth-child(%@)'.fmt(leafIndex)).css('width', '%@px'.fmt(cellWidth));
                this.get('owner')._synchronizeColumnWidth();
            } else {
                var width = this.getPath('owner.offset') + deltaX - 2;
                if (width < 30) { width = 30; }
                if (jQuery.browser.mozilla) {
                    width -= 1;
                } else if (jQuery.browser.webkit || jQuery.browser.msie) {
                    width -= 2;
                }
                // Move data table and column header
                this.getPath('owner.scrollable').css('left', '%@px'.fmt(width));
                this.getPath('owner.columnHeader').parent().css('left', '%@px'.fmt(width));
                this.getPath('owner.tableCorner').css('width', '%@px'.fmt(width));
                // Update column width
                var depth = this.getPath('owner.rowDepth');
                leafIndex = depth - cell.nextAll().length;
                cell.parents('table').find('colgroup :nth-child(%@)'.fmt(leafIndex)).css('width', '%@px'.fmt(cellWidth));
            }
        },

        mouseUp: function(event) {
            this.gotoState('idle');
            return true;
        }
    }),

    _synchronizeColumnWidth: function() {
        // Update data table columns
        var cell = this.get('resizingCell');
        var table = this.get('childViews')[0];
        var width = parseInt(cell.css('width'), 10);
        var index = parseInt(cell.attr('data-leaf-index'), 10);
        var resizeDelegate = this.get('resizeDelegate');
        if (resizeDelegate && resizeDelegate.columnResized) {
            resizeDelegate.columnResized(index, width);

        }
        if (jQuery.browser.webkit || jQuery.browser.msie) { width += 4; }
        if (jQuery.browser.mozilla) { width -= 2; }
        table.updateColumnWidth(index, width);
    },

    willInsertElement: function() {
        var scrollable = this.get('scrollable');
        if (scrollable) {
            scrollable.unbind();
        }
    },

    didInsertElement: function() {
        this.set('scrollable', this.$('.flame-table').parent().parent());
        this.set('rowHeader', this.$('.row-header table'));
        this.set('columnHeader', this.$('.column-header table'));
        this.set('tableCorner', this.$('.table-corner'));
        this.get('scrollable').scroll({self: this}, this.didScroll);
    },

    didScroll: function(event) {
        var self = event.data.self;
        var scrollable = self.get('scrollable');
        // Scroll fixed headers
        self.get('rowHeader').css('top', '-%@px'.fmt(scrollable.scrollTop()));
        self.get('columnHeader').css('left', '-%@px'.fmt(scrollable.scrollLeft()));
    },

    _headersDidChange: function() {
        if (this.get('allowRefresh')) {
            this.rerender();
        }
        // When the headers change, fully re-render the view
    }.observes('contentAdapter.headers', 'allowRefresh'),

    render: function(buffer) {
        this._renderElementAttributes(buffer);
        var isSimpleTable = this.get('isSimpleTable');
        var didRenderTitle = false;

        var headers = this.getPath('contentAdapter.headers');
        if (!headers) {
            return; // Nothing to render
        }
        // HomeView panel label
        if (this.getPath('content.title')) {
            buffer = buffer.push('<div class="panel-title">%@</div>'.fmt(this.getPath('content.title')));
            didRenderTitle = true;
        }

        var defaultColumnWidth = this.get('defaultColumnWidth');
        var columnHeaderRows = this.getPath('contentAdapter.columnHeaderRows');
        var rowHeaderRows = this.getPath('contentAdapter.rowHeaderRows');
        var columnHeaderHeight = columnHeaderRows.maxDepth * 21 + 1 + columnHeaderRows.maxDepth;
        // XXX What is this? Why does column WIDTH affect row HEIGHT?
        var rowHeight = rowHeaderRows.maxDepth * defaultColumnWidth + 1 + (isSimpleTable ? 5 : 0);
        var topOffset = didRenderTitle ? 18 : 0;

        if (!isSimpleTable) {
            // Top left corner of the headers
            buffer = buffer.push('<div class="table-corner" style="top: %@px; left: 0px; height: %@px; width: %@px;"></div>'.fmt(topOffset, columnHeaderHeight, defaultColumnWidth));
            // Column headers
            buffer = this._renderHeader(buffer, 'column', rowHeight, defaultColumnWidth);
            topOffset += columnHeaderHeight;
        }
        // Row headers
        buffer = this._renderHeader(buffer, 'row', topOffset, defaultColumnWidth);

        // Scrollable div
        buffer = buffer.begin('div').attr('style', 'overflow: auto; bottom: 0px; top: %@px; left: %@px; right: 0px;'.fmt(topOffset, rowHeight));
        buffer = buffer.attr('class', 'scrollable');
        // There should really only be one child view, the CubeTableDataView
        this.forEachChildView(function(view) {
            view.renderToBuffer(buffer);
        });
        buffer = buffer.end(); // div
    },

    _renderHeader: function(buffer, type, offset, defaultColumnWidth) {
        var headers = this.getPath('contentAdapter.headers');
        if (!headers) {
            return buffer.begin('div').end();
        }

        var position, i;
        if (type === 'column') {
            headers = this.getPath('contentAdapter.columnHeaderRows');
            position = 'left';
        } else {
            headers = this.getPath('contentAdapter.rowHeaderRows');
            position = 'top';
        }
        var length = headers.length;

        buffer = buffer.begin('div').addClass('%@-header'.fmt(type)).attr('style', 'position: absolute; %@: %@px'.fmt(position, offset));
        buffer = buffer.begin('table').attr('style', 'position: absolute').attr('width', '1px');
        buffer = buffer.begin('colgroup');
        if (type === 'row') {
            for (i = 1; i < 4; i++) {
                buffer = buffer.push('<col style="width: %@px;" class="level-%@" />'.fmt(defaultColumnWidth, i));
            }
        } else {
            var l = this.getPath('content.columnLeafs').length;
            for (i = 0; i < l; i++) {
                buffer = buffer.push('<col style="width: %@px;" />'.fmt(this.getPath('content.columnLeafs')[i].get('render_width') || defaultColumnWidth));
            }
        }
        buffer = buffer.end();
        for (i = 0; i < length; i++) {
            buffer = buffer.begin('tr');
            if (type === 'column') {
                buffer = buffer.attr('class', 'level-%@'.fmt(i + 1));
            }
            buffer = this._renderRow(buffer, headers[i], type, i);
            buffer = buffer.end(); // tr
        }
        buffer = buffer.end().end(); // table // div

        return buffer;
    },

    _renderRow: function(buffer, row, type, depth) {
        var length = row.length;
        var label, arrow, headerLabel;
        for (var i = 0; i < length; i++) {
            var header = row[i];
            buffer = buffer.begin('td');

            headerLabel = header.get ? header.get('headerLabel') : header.label;
            buffer = buffer.attr('title', headerLabel);

            if (header.rowspan > 1) {
                buffer = buffer.attr('rowspan', header.rowspan);
            }
            if (header.colspan > 1) {
                buffer = buffer.attr('colspan', header.colspan);
            }

            label = '<div class="label">%@</div>';
            buffer.attr('class', (i % 2 === 0 ? "even-col" : "odd-col"));
            if (type === 'column' && !header.hasOwnProperty('children')) { // Leaf node
                buffer = buffer.attr('data-index', i);
                // Mark the leafIndex, so when sorting its trivial to find the correct field to sort by
                buffer = buffer.attr('data-leaf-index', header.leafIndex);
                if (this.get("isResizable") && !this.get('isSimpleTable')) {
                    buffer = buffer.push('<div class="resize-handle">&nbsp;</div>');
                }

                label = '<div class="label">%@';

                if (arrow) {
                    label += '<img src="%@" style="vertical-align: middle" />'.fmt(arrow);
                }
                label += '</div>';
            } else if (type === 'row') {
                buffer = buffer.attr('data-index', depth % this.getPath('content.rowLeafs').length);
                if (!this.get('isSimpleTable')) {
                    if (this.get("isResizable")) {
                        if (header.hasOwnProperty('children')) {
                            buffer = buffer.push('<div class="resize-handle" style="height: %@px"></div>'.fmt(header.children.length * 21));
                        } else {
                            buffer = buffer.push('<div class="resize-handle"></div>');
                        }
                    }
                    if (this.get("isRowHeaderClickable") && header.get('isClickable')) {
                        label = '<a href="javascript:void(0)">%@</a>';
                    }
                }
            }
            buffer = buffer.push(label.fmt(headerLabel)).end(); // td
        }
        return buffer;
    }
});

Flame.TextAreaView = Flame.View.extend({
    classNames: ['flame-text'],
    childViews: ['textArea'],
    layout: { left: 0, top: 0 },
    defaultHeight: 20,
    defaultWidth: 200,

    value: '',
    placeholder: null,
    isValid: null,
    isVisible: true,

    becomeKeyResponder: function() {
        this.get('textArea').becomeKeyResponder();
    },

    textArea: Ember.TextArea.extend(Flame.EventManager, Flame.FocusSupport, {
        classNameBindings: ['isInvalid', 'isFocused'],
        acceptsKeyResponder: true,
        // Start from a non-validated state. 'isValid' being null means that it hasn't been validated at all (perhaps
        // there's no validator attached) so it doesn't make sense to show it as invalid.
        isValid: null,
        isInvalidBinding: Ember.Binding.from('isValid').transform(function(v) {
            return v === false;
        }).oneWay(),
        valueBinding: '^value',
        placeholderBinding: '^placeholder',
        isVisibleBinding: '^isVisible',

        keyDown: function() { return false; },
        keyUp: function() {
            this._elementValueDidChange();
            return false;
        }
    })
});


/*
  A child view in a TreeView. In most cases you don't need to extend this, you can instead define
  a handlebarsMap on the tree view. If you want to use a custom view instead of handlebars, consider
  extending this class and defining a custom treeItemViewClass (see below). If you do need to override
  the rendering directly in this class, you should note that you're then responsible for rendering
  also the nested list view (and a toggle button if you want one).

  TODO Should perhaps extract the class definition used in treeItemViewClass into a separate subclass
       for easier extending.
 */

Flame.TreeItemView = Flame.ListItemView.extend({
    useAbsolutePositionBinding: 'parentView.rootTreeView.useAbsolutePositionForItems',
    classNames: ['flame-tree-item-view'],
    classNameBindings: ['parentView.nestingLevel'],
    isExpandedBinding: Ember.Binding.or('content.treeItemIsExpanded', 'defaultIsExpanded'),
    layout: { left: 0, right: 0, top: 0, height: 0 },

    defaultIsExpanded: function() {
        return this.getPath('parentView.rootTreeView.defaultIsExpanded');
    }.property('parentView.rootTreeView.defaultIsExpanded').cacheable(),

    init: function() {
        this._super();
    },

    // Don't use the list view isSelected highlight logic
    isSelected: function(key, value) {
        return false;
    }.property().cacheable(),

    // This is the highlight logic for tree items, the is-selected class is bound to the flame-tree-item-view-container
    classAttribute: function() {
        return this.get('content') === this.getPath('parentView.rootTreeView.selection') ? 'flame-tree-item-view-container is-selected' : 'flame-tree-item-view-container';
    }.property('content', 'parentView.rootTreeView.selection').cacheable(),

    // The HTML that we need to produce is a bit complicated, because while nested items should appear
    // indented, the selection highlight should span the whole width of the tree view, and should not
    // cover possible nested list view that shows possible children of this item. The div with class
    // flame-tree-item-view-container is meant to display the selection highlight, and the div with class
    // flame-tree-item-view-pad handles indenting the item content. Possible nested list comes after.
    //
    // TODO It seems using handlebars templates is quite a bit slower than rendering programmatically,
    //      which is very much noticeable in IE7. Should probably convert to a render method.
    handlebars: '<div {{bindAttr class="classAttribute"}}><div class="flame-tree-item-view-pad">' +
            '{{#if hasChildren}}{{view toggleButton}}{{/if}}' +
            '{{view treeItemViewClass content=content}}</div></div>'+
            '{{#if renderSubTree}}{{view nestedTreeView}}{{/if}}',

    /**
     * Do we want to create the view for the subtree? This will return true if there is a subtree and it has
     * been shown at least once.
     *
     * Thus the view for the subtree is created lazily and never removed. To achieve the laziness, this property is
     * updated by _updateSubTreeRendering and cached.
     */
    renderSubTree: function() {
        return this.get("hasChildren") && this.get("isExpanded");
    }.property().cacheable(),

    /**
     * Force updating of renderSubTree when we need to create the subview.
     */
    _updateSubTreeRendering: function() {
        var show = this.get("renderSubTree");
        if (!show && this.get("isExpanded") && this.get("hasChildren")) {
            this.propertyWillChange("renderSubTree");
            this.propertyDidChange("renderSubTree");
        }
    }.observes("hasChildren", "isExpanded"),

    // This view class is responsible for rendering a single item in the tree. It's not the same thing as
    // the itemViewClass, because in the tree view that class is responsible for rendering the item AND
    // possible nested list view, if the item has children.
    treeItemViewClass: function() {
        return Flame.View.extend({
            useAbsolutePosition: false,
            layout: { top: 0, left: 0, right: 0, height: 20 },
            classNames: ['flame-tree-item-view-content'],
            contentIndexBinding: 'parentView.contentIndex',
            handlebars: function() {
                return this.getPath('parentView.parentView.rootTreeView').handlebarsForItem(this.get('content'));
            }.property('content').cacheable()
        });
    }.property(),

    /**
     * Get the immediate parent-view of all the TreeItemViews that are under this view in the tree. If no child views
     * are currently shown, return null.
     * The implementation of this method is intimately tied to the view structure defined in 'handlebars'-property.
     *
     * @returns {Ember.View} view that is the parent of all the next level items in the tree.
     */
    childListView: function() {
        if (this.get("renderSubTree")) {
            // Is there a nicer way to get in touch with child list? This is a bit brittle.
            return this.getPath("childViews.lastObject.childViews.firstObject");
        }
        return null;
    }.property("showsubTree").cacheable(),

    hasChildren: function() {
        return !Ember.none(this.getPath('content.treeItemChildren'));
    }.property('content.treeItemChildren'),

    mouseUp: function() {
        if (this.getPath('parentView.rootTreeView.clickTogglesIsExpanded')) {
            this.toggleProperty('isExpanded');
        }
        return false;  // Always propagate to ListItemView
    },

    // The view class displaying a disclosure view that allows expanding/collapsing possible children
    toggleButton: Flame.DisclosureView.extend({
        classNames: ['flame-tree-view-toggle'],
        ignoreLayoutManager: true,
        useAbsolutePosition: false,
        acceptsKeyResponder: false,
        visibilityTargetBinding: 'parentView.isExpanded',
        action: function() { return false; }  // Allow click to propagate to the parent
    }),

    // The view class for displaying possible nested list view, in case this item has children.
    nestedTreeView: function() {
        return Flame.TreeView.extend({
            useAbsolutePosition: this.getPath('parentView.rootTreeView.useAbsolutePositionForItems'),
            layoutManager: Flame.VerticalStackLayoutManager.create({ topMargin: 0, spacing: 0, bottomMargin: 0 }),
            layout: { top: 0, left: 0, right: 0 },
            classNames: ['flame-tree-view-nested'],
            isVisibleBinding: Ember.Binding.bool('parentView.isExpanded'), // Ember isVisible handling considers undefined to be visible
            allowSelection: this.getPath('parentView.rootTreeView.allowSelection'),
            allowReordering: this.getPath('parentView.rootTreeView.allowReordering'),
            content: this.getPath('content.treeItemChildren'),
            itemViewClass: this.getPath('parentView.rootTreeView.itemViewClass'),
            isNested: true
        });
    }.property('content')

});



/*
  A tree view displays a hierarchy of nested items. The items may all be of the same type, or there can be several
  types of items (e.g. folders and files). Tree view internally uses nested ListViews. Items with subitems can be
  expanded and collapsed.

  If allowReordering is true, items can be reordered by dragging. It is possible to drag items from one container
  to another and also between levels (e.g. from a container to its parent). Reordering is done live so that at any
  given time, user will see what the resulting order is, should they choose to release the mouse button.

  The most important properties for configuring a tree view are:

   - content: A list of the top-level items. For each item, property treeItemChildren defines its children, if any.
   - selection: The selected item in the content array or one of the children or grand-children.
   - allowSelection: Whether user can select items.
   - allowReordering: Whether user can reorder items by dragging.
   - handlebarsMap: A map of handlebars templates to use for rendering the items, for each different type. For example:
        handlebarsMap: {
            'App.Folder': '{{content.name}} ({{content.treeItemChildren.length}} reports)',
            'App.Report': '{{content.name}}',
            defaultTemplate: '{{content.title}}'
        }

  If you don't want to use handlebars templates for the item views, you can alternatively define property
  'itemViewClass', which will then be used for all item types and levels. The class you name must extend
  Flame.TreeItemView, and must also render the nested list view. See comments in TreeItemView for more info.

  TODO:
   - when selection changes, scroll the selected item to be fully visible (esp. important for keyboard selection)
   - create the nested list views lazily upon expanding (would speed up initial rendering for big trees)
   - IE testing/support
   - Syncing reorderings back to the tree content source
   - keyboard support
 */

Flame.TreeView = Flame.ListView.extend({
    classNames: ['flame-tree-view'],
    classNameBindings: ['isNested', 'nestingLevel'],
    defaultIsExpanded: false,
    itemViewClass: Flame.TreeItemView,
    isNested: false,
    clickTogglesIsExpanded: true,
    /* Whether to use absolute positioning for the items and nested lists. Currently it makes things quite tricky
       and should be avoided at all cost (don't expect everything to work just by turning this on, you will likely
       need to override the itemViewClass as well). */
    useAbsolutePositionForItems: false,

    handlebarsForItem: function(item) {
        var handlebarsMap = this.get('handlebarsMap') || {};
        return handlebarsMap[item.constructor.toString()] || handlebarsMap.defaultTemplate;
    },

    nestingLevel: function() {
        return 'level-%@'.fmt(this.getPath('treeLevel'));
    }.property('treeLevel'),

    // Propagates selection to the parent. This way we can make sure that only exactly one of the nested
    // list views is showing a selection (see property isTreeItemSelected in TreeItemView)
    _treeSelectionDidChange: function() {
        var selection = this.get('selection');
        var parentTreeView = this.get('parentTreeView');
        if (selection && parentTreeView) {
            parentTreeView.set('selection', selection);
            this.set('selection', undefined);
        }
    }.observes('selection'),

    // If this is a nested tree view, propagate the call to the parent, accumulating path to the item
    startReordering: function(dragHelper, event) {
        var parentTreeView = this.get('parentTreeView');
        if (parentTreeView) {
            dragHelper.get('itemPath').insertAt(0, this.getPath('parentView.contentIndex'));
            parentTreeView.startReordering(dragHelper, event);
        } else {
            Flame.set('mouseResponderView', this);  // XXX a bit ugly...
            this._super(dragHelper, event);
        }
    },

    treeLevel: function() {
        return (this.getPath('parentTreeView.treeLevel') || 0) + 1;
    }.property('parentTreeView.treeLevel'),

    parentTreeView: function() {
        return this.get('isNested') ? this.getPath('parentView.parentView') : undefined;
    }.property('isNested', 'parentView.parentView'),

    rootTreeView: function() {
        return this.getPath('parentTreeView.rootTreeView') || this;
    }.property('parentTreeView.rootTreeView')

});
Flame.Repeater = Ember.Object.extend(Flame.ActionSupport, {
    init: function() {
        this._super();
        this._scheduleNext();
    },

    stop: function() {
        Ember.run.cancel(this._timer);
    },

    reschedule: function() {
        this.stop();
        this._scheduleNext();
    },

    _scheduleNext: function() {
        //Use (new Date()).getTime() instead of Date.now() for IE-support.
        var wait;

        if (this.get('interval') === 0) {
            wait = 0;
        } else {
            var lastInvocation = this.get('lastInvoke');
            if (Ember.none(lastInvocation)) {
                wait = this.get('interval');
            } else {
                wait = (new Date()).getTime() - lastInvocation + this.get('interval');
            }

            if (wait < 0) {
                wait = 0;
            }
        }

        this._timer = Ember.run.later(this, function() {
            this.set('lastInvoke', (new Date()).getTime());
            this.fireAction();
            this._scheduleNext();
        }, wait);
    }
});



Flame.Validator = Ember.Object.extend({
    /**
     @param {Object} target the target object
     @param {String} key the target object property
     @returns {Boolean} validation status
     */
    validate: function(target, key) {
        return true;
    },

    validateValue: function(value) {
        return this.validate(Ember.Object.create({value: value}), 'value');
    },

    /**
     @returns {String} the property which the validator will set the result of the validation.
     */
    isValidProperty: function(key) {
        return key + 'IsValid';
    }
});

/**
 *  Mix this in to your model object to perform on the fly validation.
 *  You must provide a 'validations' hash, with the keys defining each property of your model to validate,
 *  and the values the validation logic.
 *
 *  The validation logic should be defined either as an SC validator class, a Flame validator singleton, an anonymous
 *  function, or a hash.
 *
 *  Validation is done on-demand, demand being the first call to foo.get("barIsValid") or foo.get("isValid").
 *  Thus we don't validate stuff that just goes to DataStore but only the thing we use and about whose validity we're
 *  interested in.
 *
 *  If you define 'Coupled properties' for a property foo, this means that when foo has changed, we need to revalidate not
 *  just foo but also each coupled property. For example, if we have properties password and passwordCheck, when we
 *  edit password we need to revalidate the validation for passwordCheck also.
 *
 *  Validations can only be set once to the object (this is usually done in the definition of the objects class).
 *
 */
Flame.Validatable = Ember.Mixin.create({
    _propertyValidity: null,
    _objectIsValid: null,
    _validations: null,

    isValidProperty: function(property) {
        return property + 'IsValid';
    },

    // The observer calls this method with a value, so we have to add ignoreCoupledProperties afterwards
    validateProperty: function(target, key, value, ignoreCoupledProperties) {
        if (Ember.none(ignoreCoupledProperties)) {
            ignoreCoupledProperties = false;
        }
        if (value === undefined) {
            value = target.get(key);
        }
        var validationObj = target.get('validations')[key];
        var coupledProperties = null;
        if (jQuery.isPlainObject(validationObj)) {
            var hash = validationObj;
            validationObj = hash.validation;
            coupledProperties = hash.coupledProperties;
        }

        var isValid;
        if (!jQuery.isArray(validationObj)) {
            validationObj = [validationObj];
        }
        for (var i = 0; i < validationObj.length; i++) {
            if (!(isValid = this._validate(validationObj[i], target, key, value))) {
                break;
            }
        }
        var isValidProperty = this.isValidProperty(key);
        target.beginPropertyChanges();
        target.set(isValidProperty, isValid);
        // Coupled properties are properties that should be revalidated if the original property changes
        if (!ignoreCoupledProperties && coupledProperties) {
            if (!jQuery.isArray(coupledProperties)) {
                throw "Hint: coupledProperties must be an array!";
            }
            for (var j = 0; j < coupledProperties.length; j++) {
                var coupledProperty = coupledProperties[j];
                if (coupledProperty !== key) {
                    this.validateProperty(this, coupledProperty, undefined, true);
                }
            }
        }
        target.set('isValid', target._checkValidity());
        target.endPropertyChanges();
    },

    invalidProperties: function() {
        var invalids = [];
        var validations = this.get("validations");
        for (var key in validations) {
            if (this.get(this.isValidProperty(key)) !== true) {
                invalids.push(key);
            }
        }
        return invalids;
    }.property(),

    _validate: function(validator, target, key, value) {
        var isValid = null;
        if (validator instanceof Flame.Validator) {
            isValid = validator.validate(target, key);
        } else if (!Ember.none(validator)) {
            //if not Flame.Validator, assume function
            isValid = validator.call(this, value);
        }
        return isValid;
    },

    /**
     @returns {Boolean} to indicate if all properties of model are valid.
     **/
    _checkValidity: function() {
        var validations = this.get("validations");
        for (var key in validations) {
            if (validations.hasOwnProperty(key) && this.get(this.isValidProperty(key)) !== true) {
                return false;
            }
        }
        return true;
    },

    isValid: function(key, val) {
        if (typeof val !== "undefined") {
            this._objectIsValid = val;
        }
        if (this._objectIsValid === null) { // If we haven't initialized this property yet.
            this._objectIsValid = this._checkValidity();
        }
        return this._objectIsValid;
    }.property(),

    /**
     * Allow setting of validations only once. Validations set through this property are ignored after they've been
     * set once.
     */
    validations: function(key, val) {
        if (!Ember.none(val)) {
            if (this._validations === null) {
                this._validations = val;
            } else {
                Ember.Logger.info("Trying to set validations after the validations have already been set!");
            }
        }
        return this._validations;
    }.property(),

    /**
     * Create all the *isValid properties this object should have based on its validations-property.
     */
    _createIsValidProperties: function() {
        var validations = this.get("validations");
        var propertyName;
        var self = this;
        // TODO do this without setting computer properties, using only simple properties (i.e. the kind 'foo' is when
        // defined like Ember.Object({foo: false}).
        for (propertyName in validations) {
            if (validations.hasOwnProperty(propertyName)) {
                this._createIsValidProperty(propertyName);
            }
        }
        for (propertyName in validations) {
            if (validations.hasOwnProperty(propertyName)) {
                this.addObserver(propertyName, this, 'validateProperty');
                this.validateProperty(this, propertyName);
            }
        }
    },

    _createIsValidProperty: function(propertyName) {
        if (this._propertyValidity === null) { this._propertyValidity = {}; }
        var self = this;
        Ember.defineProperty(this, this.isValidProperty(propertyName), Ember.computed(
                function(propertyIsValidName, value) {
                    // Emulate common property behaviour where setting undefined value does nothing.
                    if (typeof value !== "undefined") {
                        self.propertyWillChange(propertyIsValidName);
                        self._propertyValidity[propertyIsValidName] = value;
                        self.propertyDidChange(propertyIsValidName);
                    }
                    return self._propertyValidity[propertyIsValidName];
                }
        ).property());
    },

    /**
     * Add validation for
     * @param {String} propertyName Name of the property we want to validate.
     * @param {Object} validator Flame.Validator or function that will handle the validation of this property.
     */
    setValidationFor: function(propertyName, validator) {
        // TODO do this without setting computed properties, using only simple properties (i.e. the kind 'foo' is when
        // defined with Ember.Object({foo: false}).

        var validations = this.get("validations");
        validations[propertyName] = validator;
        this._createIsValidProperty(propertyName);
        this.removeObserver(propertyName, this, 'validateProperty'); // In case we're redefining the validation
        this.addObserver(propertyName, this, 'validateProperty');
        this.validateProperty(this, propertyName);
    },

    unknownProperty: function(key) {
        var res = /^(.+)IsValid$/.exec(key);
        var validations = this.get("validations");
        if (res && validations) {
            var propertyName = res[1];
            if (validations[propertyName]) {
                this._createIsValidProperties();
                return this.get(key);
            }
        }
        // Standard bailout, either the property wasn't of the form fooIsValid or we don't have property foo in
        // this.validations.
        return this._super(key);
    },

    setUnknownProperty: function(key, value) {
        var res = /^(.+)IsValid$/.exec(key);
        var validations = this.get("validations");
        if (res && validations) {
            var propertyName = res[1];
            if (validations[propertyName]) {
                this._createIsValidProperties();
                return this.set(key, value);
            }
        }
        // Standard bailout, either the property wasn't of the form fooIsValid or we don't have property foo in
        // this.validations.
        return this._super(key, value);
    }
});

Flame.Validator.association = Flame.Validator.create({
   validate: function(target, key) {
       var association = target.get(key);
       if (Ember.isArray(association)) {
           return association.every(function(assoc) { return assoc.get('isValid'); });
       } else if (association) {
           return association.get('isValid');
       } else {
           return true;
       }
   }
});
Flame.Validator.email = Flame.Validator.create({
    validate: function(target, key) {
        var pattern = /^(([A-Za-z0-9]+_+)|([A-Za-z0-9]+\-+)|([A-Za-z0-9]+\.+)|([A-Za-z0-9]+\++))*[A-Za-z0-9]+@((\w+\-+)|(\w+\.))*\w{1,63}\.[a-zA-Z]{2,6}$/i;
        var string = target.get(key);
        return pattern.test(string);
    }
});
Flame.Validator.notBlank = Flame.Validator.create({
   validate: function(target, key) {
       var string = target.get(key);
       if (string) {
           return !string.toString().isBlank();
       } else {
           return false;
       }
   }
});
Flame.Validator.number = Flame.Validator.create({
    validate: function(target, key) {
        var value = target.get(key);
        return (value === '') || !(isNaN(value) || isNaN(parseFloat(value)));
    }
});
