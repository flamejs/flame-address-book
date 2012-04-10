// The very first thing to do is to create the application namespace. This is done just like
// normally when using Ember.js.
var App = Ember.Application.create();

// ---

// First we define a model class for Persons. Flame.Validatable is a mixin that allows defining
// validations for properties of a model. When using Flame.FormView, those validations can then
// be automatically checked and an error message shown when a property is not valid.
App.Person = Ember.Object.extend(Flame.Validatable, {
    validations: {
        firstName: [Flame.Validator.notBlank],
        lastName: [Flame.Validator.notBlank]
    },

    // This is an example of a computed property. Refer to the Ember.js documentation for more
    // information about computed properties.
    fullName: function() {
        return '%@ %@'.fmt(this.get('firstName'), this.get('lastName'));
    }.property('firstName', 'lastName').cacheable()
});

// ---

// Next we define a controller for our application. In Flame/Ember, there's no need to use proxy
// objects (like in SproutCore 1.x). A useful pattern is to create one controller for each model class.
// You can think of this as a coordinating controller.
App.personsController = Ember.Object.create({
    // This array holds all persons. This can be seen to serve the function of a mediating controller.
    // In a real app, this data would come from your data store.
    all: [
        App.Person.create({ firstName: 'Luke', lastName: 'Skywalker' }),
        App.Person.create({ firstName: 'Obi-Wan', lastName: 'Kenobi' }),
        App.Person.create({ firstName: 'Darth', lastName: 'Vader' }),
        App.Person.create({ firstName: 'Han', lastName: 'Solo' }),
        App.Person.create({ firstName: 'Master', lastName: 'Yoda' }),
        App.Person.create({ firstName: 'Leia', lastName: 'Organa' })
    ],
    // This array holds all persons matching the current search text.
    searchResults: null,
    // This property holds the currently selected person.
    selected: null,
    // This property holds the current search text.
    searchText: '',

    init: function() {
        this._super();
        // Initialize results to all persons.
        this.doSearch();
    },

    // An observer that performs the searching. We observe both the search text and the full name of each person.
    // This way, it reacts also to changing person's name as well as deleting a person.
    doSearch: function() {
        var searchText = this.get('searchText');
        var searchResults = this.get('all').filter(function(person) {
            return !!person.get('fullName').match(new RegExp(searchText, 'i'));
        }).sort(function(person1, person2) {
            return Ember.compare(person1.get('lastName'), person2.get('lastName'));
        });
        this.set('searchResults', searchResults);
    }.observes('searchText', 'all.@each.fullName'),

    createPerson: function() {
        var person = App.Person.create({
            firstName: 'New',
            lastName: 'Person'
        });
        this.get('all').pushObject(person);
        // Select the new person.
        this.set('selected', person);
    },

    // This function is called when user clicks the 'Delete' button.
    confirmDelete: function() {
        var selected = this.get('selected');
        var self = this;
        if (selected) {
            // Flame.AlertPanel is a panel for displaying simple messages to user, optionally with some buttons
            // like Cancel and OK. The #warn method is a helper that includes a warning icon in the dialog.
            Flame.AlertPanel.warn({
                title: 'Confirm Delete',
                message: 'Are you sure you want to delete %@?'.fmt(selected.get('fullName')),
                onConfirm: function() {
                    this._super();
                    self.deleteSelectedPerson();
                }
            }).popup();
        }
    },

    // This function is called when user confirms the delete in the warning dialog.
    deleteSelectedPerson: function() {
        var selected = this.get('selected');
        this.set('selected', null);
        this.get('all').removeObject(selected);
    }

});

// ---

// This is the root view of the application. You can make it shown initially by either using a
// handlebars template in the index.html, as done in this application, or by calling its
// append method upon initializing your application.
App.RootView = Flame.RootView.extend({
    // We need to bind to various properties of the controller quite a few times in the child views.
    // Instead of repeating 'App.personsController' every time, we define it once here and then refer
    // to this definition later on, with Flame's prefixed binding syntax. This is especially useful
    // for defining reusable custom views: the controller to use can be defined just once where the
    // view is used, and all its child views will then bind to that.
    controller: App.personsController,
    childViews: 'splitView'.w(),

    // A horizontal split view divides the view in two, showing a draggable separator between the two parts.
    splitView: Flame.HorizontalSplitView.extend({
        leftWidth: 250,
        minLeftWidth: 200,

        // Split view always has to have child views named 'leftView' and 'rightView'. You don't need to
        // define the childViews array yourself for a split view.
        leftView: Flame.View.extend({
            childViews: 'titleView searchFieldView listView'.w(),

            // This is the bar at the top of the left view, showing the buttons and the application title.
            titleView: Flame.View.extend({
                layout: { height: 35, left: 0, right: 0, top: 0 },
                classNames: ['title'],
                childViews: 'aboutButtonView labelView addButtonView'.w(),

                aboutButtonView: Flame.ButtonView.extend({
                    acceptsKeyResponder: false,
                    layout: { top: 5, left: 5, width: 25 },
                    title: '?',
                    // Generally it's recommended to write actions in controllers and keep views fully
                    // declarative. But sometimes it makes sense to do this kind of very simple things
                    // directly in the view code.
                    action: function() {
                        App.AboutPanel.create().popup();
                    }
                }),

                labelView: Flame.LabelView.extend({
                    layout: { left: 35, right: 35, top: 7 },
                    textAlign: Flame.ALIGN_CENTER,
                    value: 'Address Book'
                }),

                addButtonView: Flame.ButtonView.extend({
                    acceptsKeyResponder: false,
                    layout: { top: 5, right: 5, width: 25 },
                    title: '+',
                    // You can define the target either as a binding or as a literal. Either way, make sure
                    // the controller has been defined when this is evaluated (usually you want to load all
                    // controllers before views). Here we use Flame's special prefixed binding syntax: the
                    // caret in the beginning of the binding path means to look up that property in the parent
                    // view chain and bind to that. An alternative would be to use binding paths like
                    // 'parentView.parentView.parentView.controller', but that's verbose and fragile.
                    targetBinding: '^controller',
                    action: 'createPerson'
                })
            }),

            searchFieldView: Flame.SearchTextFieldView.extend({
                layout: { top: 42, left: 5, right: 5 },
                placeholder: 'Search',
                // Here we use a binding to bind the value of the text field to a property in the controller.
                // The property is updated live when user types in the field. The controller has an observer
                // that reacts to changes and updates the list of persons appropriately.
                valueBinding: '^controller.searchText'
            }),

            // List view is a view that creates a child view for each item in its content array.
            listView: Flame.ListView.extend({
                layout: { top: 70, left: 0, right: 0, bottom: 0 },
                contentBinding: '^controller.searchResults',
                selectionBinding: '^controller.selected',
                // This is the view class that is used for the child views. It should always be a subclass
                // of Flame.ListItemView.
                itemViewClass: Flame.ListItemView.extend({
                    // Any Flame view can either define its contents through nested child views or an embedded
                    // handlebars template. Using a template is a very handy way to produce dynamic text.
                    handlebars: "{{content.fullName}}"
                })
            })
        }),

        // This is the right side of the split view, showing the details of the selected person.
        rightView: Flame.View.extend({
            // Here we use a VerticalStackLayoutManager to manage the layout of this view. It will automatically
            // place the child views on top of each other, based on the height of each child.
            layoutManager: Flame.VerticalStackLayoutManager.create({
                topMargin: 5,
                spacing: 5,
                bottomMargin: 5
            }),
            layout: { top: 20, left: 20, right: 20 },
            // This binding uses a transform so that the resulting value is 'true' when no person has been selected,
            // hiding this view.
            isVisibleBinding: Ember.Binding.from('^controller.selected').isNull().not(),
            childViews: 'formView deleteButtonView'.w(),

            // Flame.FormView is a helper that dynamically creates a number of fields with associated labels.
            // It's also able to show validation messages if the value of a field is not valid.
            formView: Flame.FormView.extend({
                objectBinding: '^controller.selected',
                labelWidth: 80,
                controlWidth: 200,
                properties: [
                    { property: 'firstName', label: 'First name',
                      validation: 'Please provide a first name' },
                    { property: 'lastName', label: 'Last name',
                      validation: 'Please provide a last name' }
                ]
            }),

            deleteButtonView: Flame.ButtonView.extend({
                layout: { left: 230, width: 80 },
                title: 'Delete',
                targetBinding: '^controller',
                action: 'confirmDelete'
            })
        })
    })
});

// ---

// This panel that is shown when user clicks the '?' button.
App.AboutPanel = Flame.Panel.extend({
    layout: { width: 350, height: 160, centerX: 0, centerY: -50 },
    title: 'Flame.js Example Application',
    allowMoving: true,

    // A Flame.Panel should always have exactly one child view, called 'contentView'.
    contentView: Flame.View.extend({
        layout: { top: 50, left: 20, right: 20, height: 150 },
        // Embedded handlebars templates are also handy for producing bits of HTML markup.
        handlebars: '<p>This is an example application for '+
            '<a href="https://github.com/flamejs/flame.js" target="_blank">Flame.js</a>.</p>'+
            '<p>The source can be found on <a href="https://github.com/flamejs/flame-address-book"'+
            ' target="_blank">GitHub</a>.</p>'+
            '<p>Also check out the <a href="http://flamejs.github.com/flame-address-book/docs/app.html"'+
            ' target="_blank">annotated source code</a>.</p>'
    })
});
