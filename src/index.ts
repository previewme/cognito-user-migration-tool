import { UserMigrationTriggerEvent } from 'aws-lambda';
import { AdminGetUserCommand, AdminGetUserCommandOutput, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { AssumeRoleCommand, AssumeRoleResponse, STSClient } from '@aws-sdk/client-sts';

const oldUserPoolId = process.env.OLD_USER_POOL_ID;
const oldAwsAccountId = process.env.OLD_AWS_ACCOUNT_ID;
const oldAssumeRoleName = process.env.OLD_ASSUME_ROLE_NAME;
const oldRegion = process.env.OLD_REGION;
const newRegion = process.env.NEW_REGION;

export async function getSecurityToken(): Promise<AssumeRoleResponse> {
    const stsClient = new STSClient({ region: newRegion });

    const params = {
        RoleArn: `arn:aws:iam::${oldAwsAccountId}:role/${oldAssumeRoleName}`,
        RoleSessionName: `migrate-user-lambda`
    };

    const assumeRoleCommand = new AssumeRoleCommand(params);
    return await stsClient.send(assumeRoleCommand);
}

async function getOldUser(event: UserMigrationTriggerEvent): Promise<AdminGetUserCommandOutput> {
    const assumeRole = await getSecurityToken();
    if (assumeRole.Credentials === undefined) {
        throw Error('Could not assume role');
    }

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
    if (!(event.triggerSource === 'UserMigration_Authentication' || event.triggerSource === 'UserMigration_ForgotPassword')){
        throw Error('Bad triggerSource');
    }

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
