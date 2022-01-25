import { handler } from '../src';
import { default as userMigrationAuthenticationEvent } from './resources/user-migration-authentication-event.json';
import { default as userMigrationForgotPasswordEvent } from './resources/user-migration-forgot-password-event.json';
import { UserMigrationTriggerEvent } from 'aws-lambda';

const authenticationUserMigrationEvent: UserMigrationTriggerEvent = userMigrationAuthenticationEvent as UserMigrationTriggerEvent;
const forgotPasswordUserMigrationEvent: UserMigrationTriggerEvent = userMigrationForgotPasswordEvent as UserMigrationTriggerEvent;
let mockSendAssumeRoleCommand = jest.fn();
const mockSend = jest.fn();

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
            return { send: mockSend };
        }),
        AdminInitiateAuthCommand: jest.fn(() => {
            return true;
        }),
        AdminGetUserCommand: jest.fn(() => {
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
                Credentials: {
                    AccessKeyId: 'accessKeyId',
                    SecretAccessKey: 'secretAccessKey'
                }
            };
        });
    });

    test('Throw error when role cannot be assumed due to AccessKeyId and SecretAccessKey being undefined', async () => {
        mockSendAssumeRoleCommand = jest.fn(() => {
            return {
                Credentials: {
                    AccessKeyId: undefined,
                    SecretAccessKey: undefined
                }
            };
        });

        await expect(handler(authenticationUserMigrationEvent)).rejects.toThrow('Could not assume role');
    });

    test('Throw error when role cannot be assumed due to AccessKeyId existing and SecretAccessKey being undefined', async () => {
        mockSendAssumeRoleCommand = jest.fn(() => {
            return {
                Credentials: {
                    AccessKeyId: 'accessKeyId',
                    SecretAccessKey: undefined
                }
            };
        });

        await expect(handler(authenticationUserMigrationEvent)).rejects.toThrow('Could not assume role');
    });

    test('Throw error when role cannot be assumed due to AccessKeyId being undefined and SecretAccessKey existing', async () => {
        mockSendAssumeRoleCommand = jest.fn(() => {
            return {
                Credentials: {
                    AccessKeyId: undefined,
                    SecretAccessKey: 'secretAccessKey'
                }
            };
        });

        await expect(handler(authenticationUserMigrationEvent)).rejects.toThrow('Could not assume role');
    });

    test('Throw error when role cannot be assumed due to credentials not existing', async () => {
        mockSendAssumeRoleCommand = jest.fn(() => {
            return {
                Credentials: undefined
            };
        });

        await expect(handler(authenticationUserMigrationEvent)).rejects.toThrow('Could not assume role');
    });

    test('Allow old user attributes to be added to a new user on authentication', async () => {
        mockSend.mockResolvedValueOnce({ AuthenticationResult: 'Success' }).mockResolvedValue({
            Enabled: true,
            UserAttributes: [
                {
                    Name: 'custom:previewme_user_id',
                    Value: 'test-previewme-user-id'
                },
                {
                    Name: 'email',
                    Value: 'test-email'
                }
            ],
            Username: 'test@jest.com',
            UserStatus: 'CONFIRMED'
        });

        const event = await handler(authenticationUserMigrationEvent);
        expect(event.response.userAttributes['custom:previewme_user_id']).toEqual('test-previewme-user-id');
        expect(event.response.userAttributes['email']).toEqual('test-email');
        expect(event.response.userAttributes['email_verified']).toEqual('true');
        expect(event.response.messageAction).toEqual('SUPPRESS');
        expect(event.response.finalUserStatus).toEqual('CONFIRMED');
    });

    test('Allow old user attributes to be added to a new user on forget password', async () => {
        mockSend.mockResolvedValue({
            Enabled: true,
            UserAttributes: [
                {
                    Name: 'custom:previewme_user_id',
                    Value: 'test-previewme-user-id'
                },
                {
                    Name: 'email',
                    Value: 'test-email'
                }
            ],
            Username: 'test@jest.com',
            UserStatus: 'CONFIRMED'
        });

        const event = await handler(forgotPasswordUserMigrationEvent);
        expect(event.response.userAttributes['custom:previewme_user_id']).toEqual('test-previewme-user-id');
        expect(event.response.userAttributes['email']).toEqual('test-email');
        expect(event.response.userAttributes['email_verified']).toEqual('true');
        expect(event.response.messageAction).toEqual('SUPPRESS');
        expect(event.response.finalUserStatus).toEqual('CONFIRMED');
    });

    test('Throw error when user doesnt exist', async () => {
        mockSend.mockResolvedValue({});
        await expect(handler(authenticationUserMigrationEvent)).rejects.toThrow('Incorrect email or password.');
    });

    test('No attributes to migrate', async () => {
        delete process.env.ATTRIBUTES_TO_MIGRATES;
        mockSend.mockResolvedValueOnce({ AuthenticationResult: 'Success' }).mockResolvedValue({
            Enabled: true,
            Username: 'test@jest.com',
            UserStatus: 'CONFIRMED'
        });
        const event = await handler(authenticationUserMigrationEvent);
        expect(event.response.userAttributes['custom:previewme_user_id']).toEqual(undefined);
        expect(event.response.userAttributes['email']).toEqual(undefined);
        expect(event.response.userAttributes['email_verified']).toEqual('true');
        expect(event.response.messageAction).toEqual('SUPPRESS');
        expect(event.response.finalUserStatus).toEqual('CONFIRMED');
    });

    test('Only transfer intended attributes', async () => {
        mockSend.mockResolvedValueOnce({ AuthenticationResult: 'Success' }).mockResolvedValue({
            Enabled: true,
            UserAttributes: [
                {
                    Name: 'invalid-name',
                    Value: 'test-previewme-user-id'
                },
                {
                    Name: 'email',
                    Value: 'test-email'
                }
            ],
            Username: 'test@jest.com',
            UserStatus: 'CONFIRMED'
        });

        const event = await handler(authenticationUserMigrationEvent);
        expect(event.response.userAttributes['invalid-name']).toEqual(undefined);
        expect(event.response.userAttributes['email']).toEqual('test-email');
        expect(event.response.userAttributes['email_verified']).toEqual('true');
        expect(event.response.messageAction).toEqual('SUPPRESS');
        expect(event.response.finalUserStatus).toEqual('CONFIRMED');
    });

    test('Only transfer attributes if the format is correct', async () => {
        mockSend.mockResolvedValueOnce({ AuthenticationResult: 'Success' }).mockResolvedValue({
            Enabled: true,
            UserAttributes: [
                {
                    Value: 'test-previewme-user-id'
                },
                {
                    Name: 'email'
                }
            ],
            Username: 'test@jest.com',
            UserStatus: 'CONFIRMED'
        });

        const event = await handler(authenticationUserMigrationEvent);
        expect(event.response.userAttributes['test-previewme-user-id']).toEqual(undefined);
        expect(event.response.userAttributes['email']).toEqual(undefined);
        expect(event.response.userAttributes['email_verified']).toEqual('true');
        expect(event.response.messageAction).toEqual('SUPPRESS');
        expect(event.response.finalUserStatus).toEqual('CONFIRMED');
    });

    test('Throw error when cannot retrieve user for forgot password', async () => {
        mockSend.mockResolvedValue(undefined);
        await expect(handler(forgotPasswordUserMigrationEvent)).rejects.toThrow('Incorrect email or password.');
    });
});
