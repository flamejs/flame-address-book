var App = Em.Application.create();

App.RootView = Flame.RootView.extend({
    layout: { top: 0, left: 0, right: 0, bottom: 0 },
    childViews: 'splitView'.w(),

    splitView: Flame.HorizontalSplitView.extend({
        leftWidth: 250,
        minLeftWidth: 200,

        leftView: Flame.View.extend({
            childViews: 'titleView searchFieldView listView'.w(),

            titleView: Flame.View.extend({
                layout: { height: 35, left: 0, right: 0, top: 0 },
                classNames: ['title'],
                childViews: 'labelView addButtonView'.w(),

                labelView: Flame.LabelView.extend({
                    layout: { left: 5, right: 5, top: 5 },
                    textAlign: Flame.ALIGN_CENTER,
                    value: 'Address Book'
                }),

                addButtonView: Flame.ButtonView.extend({
                    acceptsKeyResponder: false,
                    layout: { top: 5, right: 10, width: 25 }
                })
            }),

            searchFieldView: Flame.SearchTextFieldView.extend({
                layout: { top: 42, left: 5, right: 5 },
                placeholder: 'Search'
            }),

            listView: Flame.ListView.extend({
                layout: { top: 70, left: 0, right: 0 },
                contentBinding: 'App.peopleController.content',
                selectionBinding: 'App.personController.content',
                itemViewClass: Flame.ListItemView.extend({
                    handlebars: "&nbsp;&nbsp;{{content.fullName}}"
                })
            })
        }),

        rightView: Flame.View.extend({
            childViews: 'formView'.w(),

            formView: Flame.FormView.extend({
                layout: { top: 20, left: 20, right: 20, bottom: 20 },
                objectBinding: 'App.personController.content',
                isVisibleBinding: Ember.Binding.from('App.personController.content').isNull().not(),
                labelWidth: 80,
                controlWidth: 200,
                properties: [
                    { property: 'firstName', label: 'First name', validation: 'Please provide a first name' },
                    { property: 'lastName', label: 'Last name', validation: 'Please provide a last name' }
                ]
            })
        })
    })
});

