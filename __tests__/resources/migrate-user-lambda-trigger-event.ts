import { UserMigrationTriggerEvent } from 'aws-lambda';

export function migrateUserLambdaTriggerEvent(
    triggerSource: 'UserMigration_Authentication' | 'UserMigration_ForgotPassword'
): UserMigrationTriggerEvent {
    return {
        version: 'string',
        triggerSource: triggerSource,
        region: 'AWSRegion',
        userPoolId: 'string',
        userName: 'string',
        callerContext: {
            awsSdkVersion: 'string',
            clientId: 'string'
        },
        request: {
            password: 'string',
            validationData: {
                string: 'string'
            },
            clientMetadata: {
                string: 'string'
            }
        },
        response: {
            userAttributes: {
                string: 'string'
            },
            messageAction: 'RESEND',
            desiredDeliveryMediums: [],
            forceAliasCreation: true
        }
    };
}
