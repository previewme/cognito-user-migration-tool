import { UserMigrationTriggerEvent } from 'aws-lambda';
import { CognitoIdentityProviderClient, ListUsersCommand, UserType } from '@aws-sdk/client-cognito-identity-provider';

async function getOldUser(event: UserMigrationTriggerEvent): Promise<UserType | undefined> {
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
    const attributesToMigrate = process.env.ATTRIBUTES_TO_MIGRATES;

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
