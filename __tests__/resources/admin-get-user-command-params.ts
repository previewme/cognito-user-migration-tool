export function adminGetUserCommandParams(attributes: any[] | undefined) {
    return {
        Enabled: true,
        MFAOptions: [
            {
                AttributeName: 'string',
                DeliveryMedium: 'string'
            }
        ],
        PreferredMfaSetting: 'string',
        UserAttributes: attributes,
        UserCreateDate: 0,
        UserLastModifiedDate: 0,
        UserMFASettingList: ['string'],
        Username: 'string',
        UserStatus: 'string'
    };
}
