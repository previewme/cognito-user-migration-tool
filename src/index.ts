import { UserMigrationTriggerEvent } from 'aws-lambda';
import { AdminGetUserCommand, AdminGetUserCommandOutput, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
const oldUserPoolId = process.env.OLD_USER_POOL_ID;
const oldRegion = process.env.OLD_REGION;

async function getOldUser(event: UserMigrationTriggerEvent): Promise<AdminGetUserCommandOutput> {
    const params = {
        UserPoolId: oldUserPoolId,
        Username: event.userName
    };

    const cognitoIdentityProviderClient = new CognitoIdentityProviderClient({ region: oldRegion });
    const adminGetUserCommand = new AdminGetUserCommand(params);
    return await cognitoIdentityProviderClient.send(adminGetUserCommand);
}

function generateUserAttributes(oldUser: AdminGetUserCommandOutput) {
    const userAttributesMap = new Map();
    if (oldUser.UserAttributes) {
        oldUser.UserAttributes.forEach((userAttribute) => {
            if (userAttribute.Name && userAttribute.Value) {
                userAttributesMap.set(userAttribute.Name, userAttribute.Value);
            }
        });
    }

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
