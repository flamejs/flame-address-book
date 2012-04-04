App.Person = Ember.Object.extend(Flame.Validatable, {
    validations: {
        firstName: [Flame.Validator.notBlank],
        lastName: [Flame.Validator.notBlank]
        //email: [Flame.Validator.email]
    },

    fullName: function() {
        return '%@ %@'.fmt(this.get('firstName'), this.get('lastName'));
    }.property('firstName', 'lastName').cacheable()
});

App.peopleController = Ember.Object.create({
    content: [
        App.Person.create({ firstName: 'Colin', lastName: 'Timmermans' }),
        App.Person.create({ firstName: 'Marko', lastName: 'Nikula' }),
        App.Person.create({ firstName: 'Jarkko', lastName: 'Miettinen' })
    ]
});

App.personController = Ember.Object.create({
    content: null
});

