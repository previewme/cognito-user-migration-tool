import { handler } from '../src';
import { default as userMigrationAuthenticationEvent } from './resources/user-migration-authentication-event.json';
import { default as userMigrationForgotPasswordEvent } from './resources/user-migration-forgot-password-event.json';
import { UserMigrationTriggerEvent } from 'aws-lambda';

const authenticationUserMigrationEvent: UserMigrationTriggerEvent = userMigrationAuthenticationEvent as UserMigrationTriggerEvent;
const forgotPasswordUserMigrationEvent: UserMigrationTriggerEvent = userMigrationForgotPasswordEvent as UserMigrationTriggerEvent;
let mockSendAdminGetUserCommand = jest.fn();
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
            return { send: mockSendAdminGetUserCommand };
        }),
        AdminGetUserCommand: jest.fn(() => {
            return {};
        })
    };
});

describe('Test migrating user', () => {
    process.env.OLD_USER_POOL_ID = 'old-user-pool-id';
    process.env.OLD_ASSUME_ROLE_NAME = 'old-assume-role-name';
    process.env.NEW_REGION = 'new-origin';

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        mockSendAssumeRoleCommand = jest.fn(() => {
            return {
                Credentials: 'mock-credentials'
            };
        });

        mockSendAdminGetUserCommand = jest.fn(() => {
            return {
                UserAttributes: [
                    {
                        Name: 'custom:previewme_user_id',
                        Value: 'test-previewme-user-id'
                    },
                    {
                        Name: 'email',
                        Value: 'test-email'
                    },
                    {
                        Name: 'email_verified',
                        Value: 'true'
                    }
                ]
            };
        });
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

    test('Throw error when role cannot be assumed', async () => {
        mockSendAssumeRoleCommand = jest.fn(() => {
            return {
                Credentials: undefined
            };
        });

        await expect(handler(authenticationUserMigrationEvent)).rejects.toThrow('Could not assume role');
    });

    test('Throw error when old user doesnt exist', async () => {
        mockSendAdminGetUserCommand = jest.fn(() => {
            return undefined;
        });

        await expect(handler(authenticationUserMigrationEvent)).rejects.toThrow('Bad password');
    });

    test('New user should have no user attributes if the old user doesnt', async () => {
        mockSendAdminGetUserCommand = jest.fn(() => {
            return {
                UserAttributes: undefined
            };
        });

        const event = await handler(authenticationUserMigrationEvent);
        expect(event.response.userAttributes).toEqual({});
        expect(event.response.messageAction).toEqual('SUPPRESS');
        expect(event.response.finalUserStatus).toEqual('CONFIRMED');
    });

    test('Only user attributes with the correct format are transferred', async () => {
        mockSendAdminGetUserCommand = jest.fn(() => {
            return {
                UserAttributes: [
                    {
                        Value: 'invalid'
                    },
                    {
                        Name: 'invalid'
                    },
                    {
                        InvalidName: 'invalid',
                        Value: 'invalid'
                    },
                    {
                        Name: 'invalid',
                        InvalidValid: 'invalid'
                    }
                ]
            };
        });

        const event = await handler(authenticationUserMigrationEvent);
        expect(event.response.userAttributes).toEqual({});
        expect(event.response.messageAction).toEqual('SUPPRESS');
        expect(event.response.finalUserStatus).toEqual('CONFIRMED');
    });
});
