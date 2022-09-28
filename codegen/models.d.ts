export interface Environment {
    createdAt: Date;
    name: SDBString;
    project: Project;
    tokens: SDBRecordLink<EnvironmentToken>;
    updatedAt: Date;
}
export interface EnvironmentToken {
    createdAt: Date;
    environment: Environment;
    name: SDBString;
    public_key: SDBString;
    secret_key: SDBString;
    updatedAt: Date;
}
export interface Feature {
    createdAt: Date;
    description: SDBString;
    project: Project;
    slug: SDBString;
    title: SDBString;
    updatedAt: Date;
}
export interface Flags {
    createdAt: Date;
    environment: Environment;
    in: Feature;
    out: Value;
    project: Project;
    updatedAt: Date;
}
export interface Project {
    color: SDBString;
    createdAt: Date;
    description: SDBString;
    environments: SDBRecordLink<Environment>;
    initials: SDBString;
    name: SDBString;
    pinned: SDBBoolean;
    updatedAt: Date;
    user: User;
}
export interface Role {
}
export interface User {
    avatar: SDBString;
    createdAt: Date;
    email: SDBString;
    name: SDBString;
    password: SDBString;
    updatedAt: Date;
}
export interface Value {
    createdAt: Date;
    environment: Environment;
    feature: Feature;
    meta: unknown;
    state: SDBBoolean;
    updatedAt: Date;
}
export type Models = SDBModel<{
    test: {
        application: {
            Environment: Environment[];
            EnvironmentToken: EnvironmentToken[];
            Feature: Feature[];
            Flags: Flags[];
            Project: Project[];
            Role: Role[];
            User: User[];
            Value: Value[];
        };
    };
}>;
