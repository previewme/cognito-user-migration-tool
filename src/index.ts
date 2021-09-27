import { UserMigrationTriggerEvent } from 'aws-lambda';
import { CognitoIdentityProviderClient, ListUsersCommand, UserType } from '@aws-sdk/client-cognito-identity-provider';
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

async function getOldUser(event: UserMigrationTriggerEvent): Promise<UserType | undefined> {
    const assumeRole = await getSecurityToken();
    if (assumeRole.Credentials === undefined) {
        throw Error('Could not assume role');
    }

    const params = {
        UserPoolId: process.env.OLD_USER_POOL_ID,
        Filter: `email = "${event.userName}"`
    };

    const cognitoIdentityProviderClient = new CognitoIdentityProviderClient({ region: process.env.OLD_REGION });
    const listUserCommand = new ListUsersCommand(params);
    const usersByEmail = await cognitoIdentityProviderClient.send(listUserCommand);
    return usersByEmail.Users && usersByEmail.Users.length > 0 ? usersByEmail.Users[0] : undefined;
}

function generateUserAttributes(oldUser: UserType) {
    const userAttributesMap = new Map();
    const attributesToMigrate = process.env.ATTRIBUTES_TO_MIGRATE;

    if (oldUser.Attributes && attributesToMigrate) {
        const attributesToMigrateArray = attributesToMigrate.split(',');
        oldUser.Attributes.forEach((userAttribute) => {
            if (userAttribute.Name && userAttribute.Value && attributesToMigrateArray.includes(userAttribute.Name)) {
                userAttributesMap.set(userAttribute.Name, userAttribute.Value);
            }
        });
    }

    userAttributesMap.set('email_verified', 'true');
    return Object.fromEntries(userAttributesMap);
}

export async function handler(event: UserMigrationTriggerEvent): Promise<UserMigrationTriggerEvent> {
    const oldUser = await getOldUser(event);

    if (oldUser) {
        event.response.userAttributes = generateUserAttributes(oldUser);
        event.response.messageAction = 'SUPPRESS';
    } else {
        throw Error('Bad password');
    }

    if (event.triggerSource === 'UserMigration_Authentication') {
        event.response.finalUserStatus = 'CONFIRMED';
    }

    return event;
}

exports.handler = handler;
