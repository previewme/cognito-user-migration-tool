import { handler } from '../src';
import { default as userMigrationAuthenticationEvent } from './resources/user-migration-authentication-event.json';
import { default as userMigrationForgotPasswordEvent } from './resources/user-migration-forgot-password-event.json';
import { UserMigrationTriggerEvent } from 'aws-lambda';

const authenticationUserMigrationEvent: UserMigrationTriggerEvent = userMigrationAuthenticationEvent as UserMigrationTriggerEvent;
const forgotPasswordUserMigrationEvent: UserMigrationTriggerEvent = userMigrationForgotPasswordEvent as UserMigrationTriggerEvent;
let mockSendListUsersCommand = jest.fn();
let mockSendAssumeRoleCommand = jest.fn();

jest.mock('@aws-sdk/client-sts', () => {
    return {
        STSClient: jest.fn(() => {
            return { send: mockSendAssumeRoleCommand };
        }),
        AssumeRoleCommand: jest.fn(() => {
            return {};
        })
    };
});

jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
    return {
        CognitoIdentityProviderClient: jest.fn(() => {
            return { send: mockSendListUsersCommand };
        }),
        ListUsersCommand: jest.fn(() => {
            return {};
        })
    };
});

describe('Test migrating user', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        process.env.ATTRIBUTES_TO_MIGRATE = 'custom:previewme_user_id,email';

        mockSendAssumeRoleCommand = jest.fn(() => {
            return {
                Credentials: 'mock-credentials'
            };
        });

        mockSendListUsersCommand = jest.fn(() => {
            return {
                Users: [
                    {
                        Attributes: [
                            {
                                Name: 'custom:previewme_user_id',
                                Value: 'test-previewme-user-id'
                            },
                            {
                                Name: 'email',
                                Value: 'test-email'
                            }
                        ]
                    }
                ]
            };
        });
    });

    test('Throw error when role cannot be assumed', async () => {
        mockSendAssumeRoleCommand = jest.fn(() => {
            return {
                Credentials: undefined
            };
        });

        await expect(handler(authenticationUserMigrationEvent)).rejects.toThrow('Could not assume role');
    });

    test('Allow old user attributes to be added to a new user on authentication', async () => {
        const event = await handler(authenticationUserMigrationEvent);
        expect(event.response.userAttributes['custom:previewme_user_id']).toEqual('test-previewme-user-id');
        expect(event.response.userAttributes['email']).toEqual('test-email');
        expect(event.response.userAttributes['email_verified']).toEqual('true');
        expect(event.response.messageAction).toEqual('SUPPRESS');
        expect(event.response.finalUserStatus).toEqual('CONFIRMED');
    });

    test('Allow old user attributes to be added to a new user on forget password', async () => {
        const event = await handler(forgotPasswordUserMigrationEvent);
        expect(event.response.userAttributes['custom:previewme_user_id']).toEqual('test-previewme-user-id');
        expect(event.response.userAttributes['email']).toEqual('test-email');
        expect(event.response.userAttributes['email_verified']).toEqual('true');
        expect(event.response.messageAction).toEqual('SUPPRESS');
        expect(event.response.finalUserStatus).toEqual(undefined);
    });

    test('Throw error when old user doesnt exist', async () => {
        mockSendListUsersCommand = jest.fn(() => {
            return {
                Users: []
            };
        });

        await expect(handler(authenticationUserMigrationEvent)).rejects.toThrow('Bad password');
    });

    test('No attributes to migrate', async () => {
        delete process.env.ATTRIBUTES_TO_MIGRATE;
        const event = await handler(authenticationUserMigrationEvent);
        expect(event.response.userAttributes['custom:previewme_user_id']).toEqual(undefined);
        expect(event.response.userAttributes['email']).toEqual(undefined);
        expect(event.response.userAttributes['email_verified']).toEqual('true');
        expect(event.response.messageAction).toEqual('SUPPRESS');
        expect(event.response.finalUserStatus).toEqual('CONFIRMED');
    });

    test('No attributes to migrate', async () => {
        delete process.env.ATTRIBUTES_TO_MIGRATES;
        mockSendListUsersCommand = jest.fn(() => {
            return {
                Users: [{}]
            };
        });
        const event = await handler(authenticationUserMigrationEvent);
        expect(event.response.userAttributes['email_verified']).toEqual('true');
        expect(event.response.messageAction).toEqual('SUPPRESS');
        expect(event.response.finalUserStatus).toEqual('CONFIRMED');
    });

    test('Only transfer intended attributes', async () => {
        mockSendListUsersCommand = jest.fn(() => {
            return {
                Users: [
                    {
                        Attributes: [
                            {
                                Name: 'invalid-name',
                                Value: 'test-previewme-user-id'
                            },
                            {
                                Name: 'email',
                                Value: 'test-email'
                            }
                        ]
                    }
                ]
            };
        });

        const event = await handler(authenticationUserMigrationEvent);
        expect(event.response.userAttributes['invalid-name']).toEqual(undefined);
        expect(event.response.userAttributes['email']).toEqual('test-email');
        expect(event.response.userAttributes['email_verified']).toEqual('true');
        expect(event.response.messageAction).toEqual('SUPPRESS');
        expect(event.response.finalUserStatus).toEqual('CONFIRMED');
    });

    test('Only transfer attributes if the format is correct', async () => {
        mockSendListUsersCommand = jest.fn(() => {
            return {
                Users: [
                    {
                        Attributes: [
                            {
                                Value: 'test-previewme-user-id'
                            },
                            {
                                Name: 'email'
                            }
                        ]
                    }
                ]
            };
        });

        const event = await handler(authenticationUserMigrationEvent);
        expect(event.response.userAttributes['test-previewme-user-id']).toEqual(undefined);
        expect(event.response.userAttributes['email']).toEqual(undefined);
        expect(event.response.userAttributes['email_verified']).toEqual('true');
        expect(event.response.messageAction).toEqual('SUPPRESS');
        expect(event.response.finalUserStatus).toEqual('CONFIRMED');
    });
});
