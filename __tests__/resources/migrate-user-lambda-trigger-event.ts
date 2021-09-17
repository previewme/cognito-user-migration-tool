export function migrateUserLambdaTriggerEvent(triggerSource: string) {
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
};