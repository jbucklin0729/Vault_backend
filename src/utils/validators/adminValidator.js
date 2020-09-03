/* eslint-disable indent */
exports.adminRegistration = {
    type: 'object',
    properties: {
        email: {
            type: 'string',
            format: 'email',
        },
        password: {
            type: 'string',
            minLength: 8,
            pattern: '^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9]).{8,}$',
        },
        confirm_password: {
            const: {
                $data: '1/password',
            },
            type: 'string',
        },
    },
    errorMessage: {
        properties: {
            email: 'should be a valid email format',
            password: 'should have 8 characters minimum, contain at least 1 capital letter, lower case letter and number',
            confirm_password: 'should be the same as password',
        },
    },
    required: ['email', 'password', 'confirm_password'],
};

exports.adminLogin = {
    properties: {
        email: {
            type: 'string',
            format: 'email',
        },
        password: { type: 'string' },
    },
    required: ['email', 'password'],
};

exports.adminChangePassword = {
    properties: {
        old_password: {
            type: 'string',
        },
        new_password: {
            type: 'string',
            minLength: 8,
            pattern: '^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9]).{8,}$',
        },
        confirm_password: {
            const: {
                $data: '1/new_password',
            },
            type: 'string',
        },
    },
    errorMessage: {
        properties: {
            new_password: 'should have 8 characters minimum, contain at least 1 capital letter, lower case letter and number',
            confirm_password: 'should be the same as New Password',
        },
    },
    required: ['old_password', 'new_password', 'confirm_password'],
};

exports.adminForgotPassword = {
    properties: {
        email: {
            type: 'string',
            format: 'email',
        },
    },
    errorMessage: {
        properties: {
            email: 'should be a valid email format',
        },
    },
    required: ['email'],
};


exports.adminResetPassword = {
    properties: {
        reset_key: {
            type: 'string',
        },
        new_password: {
            type: 'string',
            minLength: 8,
            pattern: '^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9]).{8,}$',
        },
        confirm_password: {
            const: {
                $data: '1/new_password',
            },
            type: 'string',
        },
    },
    errorMessage: {
        properties: {
            new_password: 'should have 8 characters minimum, contain at least 1 capital letter, lower case letter and number',
            confirm_password: 'should be the same as New Password',
        },
    },
    required: ['reset_key', 'new_password', 'confirm_password'],
};

exports.addToken = {
    type: 'object',
    properties: {
        name: {
            type: 'string',
        },
        symbol: {
            type: 'string',
        },
        image: {
            type: 'string',
        },
    },
    errorMessage: {
        properties: {
            name: 'is required and should be a string',
            symbol: 'is required and should be a string',
            image: 'should be a string',
        },
    },
    required: ['name', 'symbol'],
};

exports.removeAndUpdateTokenParams = {
    type: 'object',
    properties: {
        token_id: {
            type: 'string'
        },
    },
    errorMessage: {
        token_id: 'is required and should be a string'
    },
    required: ['token_id'],
};

exports.updateToken = {
    type: 'object',
    properties: {
        name: {
            type: 'string',
        },
        symbol: {
            type: 'string',
        },
        image: {
            type: 'string',
        },
    },
    errorMessage: {
        properties: {
            name: 'is required and should be a string',
            symbol: 'is required and should be a string',
            image: 'should be a string',
        },
    },
    required: ['name', 'symbol'],
};