import { UserMigrationTriggerEvent } from 'aws-lambda';
import {
    AdminGetUserCommand,
    AdminGetUserCommandOutput,
    AdminInitiateAuthCommand,
    CognitoIdentityProviderClient
} from '@aws-sdk/client-cognito-identity-provider';
import { AssumeRoleCommand, AssumeRoleResponse, STSClient } from '@aws-sdk/client-sts';

async function getSecurityToken(): Promise<AssumeRoleResponse> {
    const stsClient = new STSClient({ region: process.env.AWS_REGION });

    const params = {
        RoleArn: process.env.ROLE_TO_ASSUME_ARN,
        RoleSessionName: process.env.ROLE_SESSION_NAME
    };

    const assumeRoleCommand = new AssumeRoleCommand(params);
    return await stsClient.send(assumeRoleCommand);
}

async function authenticateUser(username: string, password: string): Promise<boolean> {
    const assumeRole = await getSecurityToken();
    if (assumeRole.Credentials === undefined || !(assumeRole.Credentials.AccessKeyId && assumeRole.Credentials.SecretAccessKey)) {
        throw Error('Could not assume role');
    }
    const cognitoIdentityProviderClient = new CognitoIdentityProviderClient({
        region: process.env.SOURCE_REGION,
        credentials: {
            accessKeyId: assumeRole.Credentials.AccessKeyId,
            secretAccessKey: assumeRole.Credentials.SecretAccessKey,
            sessionToken: assumeRole.Credentials.SessionToken
        }
    });

    const command = new AdminInitiateAuthCommand({
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        AuthParameters: {
            PASSWORD: password,
            USERNAME: username
        },
        ClientId: process.env.SOURCE_CLIENT_ID,
        UserPoolId: process.env.SOURCE_USER_POOL_ID
    });
    const response = await cognitoIdentityProviderClient.send(command);
    return !!response.AuthenticationResult;
}

async function getUser(username: string): Promise<AdminGetUserCommandOutput> {
    const assumeRole = await getSecurityToken();
    if (assumeRole.Credentials === undefined || !(assumeRole.Credentials.AccessKeyId && assumeRole.Credentials.SecretAccessKey)) {
        throw Error('Could not assume role');
    }
    const cognitoIdentityProviderClient = new CognitoIdentityProviderClient({
        region: process.env.SOURCE_REGION,
        credentials: {
            accessKeyId: assumeRole.Credentials.AccessKeyId,
            secretAccessKey: assumeRole.Credentials.SecretAccessKey,
            sessionToken: assumeRole.Credentials.SessionToken
        }
    });

    const getUserCommand = new AdminGetUserCommand({
        UserPoolId: process.env.SOURCE_USER_POOL_ID,
        Username: username
    });
    return await cognitoIdentityProviderClient.send(getUserCommand);
}

function generateUserAttributes(username: AdminGetUserCommandOutput) {
    const userAttributesMap = new Map();
    const attributesToMigrate = process.env.ATTRIBUTES_TO_MIGRATE;

    if (username.UserAttributes && attributesToMigrate) {
        const attributesToMigrateArray = attributesToMigrate.split(',');
        username.UserAttributes.forEach((userAttribute) => {
            if (userAttribute.Name && userAttribute.Value && attributesToMigrateArray.includes(userAttribute.Name)) {
                userAttributesMap.set(userAttribute.Name, userAttribute.Value);
            }
        });
    }

    userAttributesMap.set('email_verified', 'true');
    return Object.fromEntries(userAttributesMap);
}

export async function handler(event: UserMigrationTriggerEvent): Promise<UserMigrationTriggerEvent> {
    if (event.triggerSource === 'UserMigration_Authentication') {
        const authenticated = await authenticateUser(event.userName, event.request.password);
        const user = await getUser(event.userName);
        if (authenticated && user) {
            event.response.userAttributes = generateUserAttributes(user);
            event.response.finalUserStatus = 'CONFIRMED';
            event.response.messageAction = 'SUPPRESS';
            return event;
        } else {
            throw new Error('Incorrect email or password.');
        }
    } else if (event.triggerSource === 'UserMigration_ForgotPassword') {
        const user = await getUser(event.userName);
        if (user) {
            event.response.userAttributes = generateUserAttributes(user);
            event.response.messageAction = 'SUPPRESS';
            return event;
        } else {
            throw new Error('Incorrect email or password.');
        }
    }
    console.error('Unknown trigger source');
    throw new Error('Please contact support');
}

exports.handler = handler;
