/* eslint-disable indent */
exports.userRegistration = {
    type: 'object',
    properties: {
        first_name: { type: 'string', minLength: 2, maxLength: 50 },
        last_name: { type: 'string', minLength: 2, maxLength: 50 },
        email: {
            type: 'string',
            format: 'email',
        },
        secondary_email: {
            type: 'string',
            format: 'email',
            not: {
                const: {
                    $data: '1/email',
                },
            },
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
            first_name: 'should be a string and should have a minimum length of 2 and maximum length of 50',
            last_name: 'should be a string and should have a minimum length of 2 and maximum length of 50',
            email: 'should be a valid email format',
            secondary_email: 'should be a valid email format and NOT the same as email',
            password: 'should have 8 characters minimum, contain at least 1 capital letter, lower case letter and number',
            confirm_password: 'should be the same as password',
        },
    },
    required: ['first_name', 'last_name', 'email', 'secondary_email', 'password', 'confirm_password'],
};

exports.balanceTypes = {
    properties: {
        type: {
            enum: [
                'single',
                'shared',
                'all'
            ],
        },
    },
    errorMessage: {
        properties: {
            type: 'is required and should be one of ["shared", "single", "all"]',
        },
    },
    required: ['type'],
}


exports.userLogin = {
    properties: {
        email: {
            type: 'string',
            format: 'email',
        },
        password: { type: 'string' },
    },
    required: ['email', 'password'],
};

exports.userChangePassword = {
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

exports.userForgotPassword = {
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

exports.userResendEmailToken = {
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

exports.userVerify = {
    properties: {
        verification_token: {
            type: 'string',
        },
        email: {
            type: 'string',
            format: 'email'
        },
    },
    errorMessage: {
        properties: {
            verification_token: 'is required for verification',
            email: 'is required and should be a valid email'
        },
    },
    required: ['verification_token', 'email'],
};

exports.userResetPassword = {
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

exports.userHydroID = {
    properties: {
        hydroID: {
            type: 'string',
        },
    },
    errorMessage: {
        properties: {
            hydroID: 'is required and should be a string',
        },
    },
    required: ['hydroID'],
};

exports.userVerifyRaindropMessage = {
    properties: {
        randomMessage: {
            type: 'string',
        },
    },
    errorMessage: {
        properties: {
            randomMessage: 'is required and should be a string',
        },
    },
    required: ['randomMessage'],
};