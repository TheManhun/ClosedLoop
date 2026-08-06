| table_schema | table_name           | ordinal_position | column_name             | data_type                | is_nullable | column_default                               |
| ------------ | -------------------- | ---------------- | ----------------------- | ------------------------ | ----------- | -------------------------------------------- |
| public       | machine_links        | 1                | id                      | bigint                   | NO          | null                                         |
| public       | machine_links        | 2                | machine_id              | bigint                   | NO          | null                                         |
| public       | machine_links        | 3                | title                   | text                     | NO          | null                                         |
| public       | machine_links        | 4                | url                     | text                     | NO          | null                                         |
| public       | machine_links        | 5                | link_type               | text                     | NO          | 'website'::text                              |
| public       | machine_links        | 6                | organisation            | text                     | YES         | null                                         |
| public       | machine_links        | 7                | description             | text                     | YES         | null                                         |
| public       | machine_links        | 8                | publication_date        | date                     | YES         | null                                         |
| public       | machine_links        | 9                | verified                | boolean                  | NO          | false                                        |
| public       | machine_links        | 10               | created_at              | timestamp with time zone | NO          | now()                                        |
| public       | machine_links        | 11               | publisher               | text                     | YES         | null                                         |
| public       | machine_links        | 12               | confidence              | numeric                  | YES         | null                                         |
| public       | machine_links        | 13               | notes                   | text                     | YES         | null                                         |
| public       | machine_profiles     | 1                | id                      | bigint                   | NO          | nextval('machine_profiles_id_seq'::regclass) |
| public       | machine_profiles     | 2                | machine_id              | bigint                   | YES         | null                                         |
| public       | machine_profiles     | 3                | profile_name            | text                     | YES         | null                                         |
| public       | machine_profiles     | 4                | organisation            | text                     | YES         | null                                         |
| public       | machine_profiles     | 5                | annual_capacity         | numeric                  | YES         | null                                         |
| public       | machine_profiles     | 6                | power_required          | numeric                  | YES         | null                                         |
| public       | machine_profiles     | 7                | water_required          | numeric                  | YES         | null                                         |
| public       | machine_profiles     | 8                | heat_required           | numeric                  | YES         | null                                         |
| public       | machine_profiles     | 9                | confidence              | numeric                  | YES         | null                                         |
| public       | machine_profiles     | 10               | source_reference        | text                     | YES         | null                                         |
| public       | machine_profiles     | 11               | notes                   | text                     | YES         | null                                         |
| public       | machine_profiles     | 12               | profile_key             | text                     | YES         | null                                         |
| public       | machine_profiles     | 13               | description             | text                     | YES         | null                                         |
| public       | machine_profiles     | 14               | data_status             | text                     | YES         | null                                         |
| public       | machine_profiles     | 15               | created_at              | timestamp with time zone | YES         | now()                                        |
| public       | machine_profiles     | 16               | updated_at              | timestamp with time zone | YES         | now()                                        |
| public       | machine_resources    | 1                | id                      | bigint                   | NO          | null                                         |
| public       | machine_resources    | 2                | machine_id              | bigint                   | YES         | null                                         |
| public       | machine_resources    | 3                | resource_id             | bigint                   | YES         | null                                         |
| public       | machine_resources    | 4                | direction               | text                     | YES         | null                                         |
| public       | machine_resources    | 5                | amount                  | numeric                  | YES         | null                                         |
| public       | machine_resources    | 6                | unit                    | text                     | YES         | null                                         |
| public       | machine_resources    | 7                | quantity_basis          | text                     | YES         | null                                         |
| public       | machine_resources    | 8                | sort_order              | integer                  | YES         | 1                                            |
| public       | machine_resources    | 9                | compatibility_metadata  | jsonb                    | YES         | '{}'::jsonb                                  |
| public       | machine_resources    | 10               | evidence_reference      | text                     | YES         | null                                         |
| public       | machine_resources    | 11               | data_status             | text                     | YES         | null                                         |
| public       | machine_resources    | 12               | confidence              | numeric                  | YES         | null                                         |
| public       | machine_resources    | 13               | created_at              | timestamp with time zone | YES         | now()                                        |
| public       | machine_resources    | 14               | updated_at              | timestamp with time zone | YES         | now()                                        |
| public       | machine_search_terms | 1                | id                      | bigint                   | NO          | null                                         |
| public       | machine_search_terms | 2                | machine_id              | bigint                   | NO          | null                                         |
| public       | machine_search_terms | 3                | search_term             | text                     | NO          | null                                         |
| public       | machine_search_terms | 4                | active                  | boolean                  | NO          | true                                         |
| public       | machine_search_terms | 5                | created_at              | timestamp with time zone | NO          | now()                                        |
| public       | machine_technologies | 1                | id                      | bigint                   | NO          | null                                         |
| public       | machine_technologies | 2                | machine_id              | bigint                   | NO          | null                                         |
| public       | machine_technologies | 3                | technology_id           | bigint                   | NO          | null                                         |
| public       | machine_technologies | 4                | role                    | text                     | YES         | null                                         |
| public       | machine_technologies | 5                | description             | text                     | YES         | null                                         |
| public       | machine_technologies | 6                | created_at              | timestamp with time zone | NO          | now()                                        |
| public       | machines             | 1                | id                      | bigint                   | NO          | null                                         |
| public       | machines             | 2                | name                    | text                     | NO          | null                                         |
| public       | machines             | 3                | description             | text                     | YES         | null                                         |
| public       | machines             | 4                | image                   | text                     | YES         | null                                         |
| public       | machines             | 5                | power_required          | numeric                  | YES         | null                                         |
| public       | machines             | 6                | water_required          | numeric                  | YES         | null                                         |
| public       | machines             | 7                | created_at              | timestamp with time zone | YES         | now()                                        |
| public       | machines             | 8                | configurable            | boolean                  | NO          | false                                        |
| public       | machines             | 9                | category                | text                     | YES         | null                                         |
| public       | machines             | 10               | footprint_x             | integer                  | NO          | 2                                            |
| public       | machines             | 11               | footprint_y             | integer                  | NO          | 2                                            |
| public       | machines             | 12               | placeable               | boolean                  | NO          | true                                         |
| public       | machines             | 13               | rotation_allowed        | boolean                  | NO          | true                                         |
| public       | machines             | 14               | build_cost              | numeric                  | YES         | null                                         |
| public       | machines             | 15               | maintenance_cost        | numeric                  | YES         | null                                         |
| public       | machines             | 16               | colour                  | text                     | YES         | null                                         |
| public       | machines             | 17               | updated_at              | timestamp with time zone | NO          | now()                                        |
| public       | machines             | 18               | stable_key              | text                     | YES         | null                                         |
| public       | machines             | 19               | annual_capacity         | numeric                  | YES         | null                                         |
| public       | machines             | 20               | capacity_unit           | text                     | YES         | null                                         |
| public       | machines             | 21               | default_operating_level | numeric                  | YES         | 1                                            |
| public       | machines             | 22               | heat_required           | numeric                  | YES         | null                                         |
| public       | machines             | 23               | heat_generated          | numeric                  | YES         | null                                         |
| public       | machines             | 24               | co2_generated           | numeric                  | YES         | null                                         |
| public       | machines             | 25               | methane_generated       | numeric                  | YES         | null                                         |
| public       | machines             | 26               | data_status             | text                     | YES         | null                                         |
| public       | machines             | 27               | source_reference        | text                     | YES         | null                                         |
| public       | machines             | 28               | confidence              | numeric                  | YES         | null                                         |
| public       | machines             | 29               | notes                   | text                     | YES         | null                                         |
| public       | resource_composition | 1                | id                      | bigint                   | NO          | null                                         |
| public       | resource_composition | 2                | parent_resource_id      | bigint                   | NO          | null                                         |
| public       | resource_composition | 3                | component_resource_id   | bigint                   | NO          | null                                         |
| public       | resource_composition | 4                | quantity                | numeric                  | YES         | null                                         |
| public       | resource_composition | 5                | unit                    | text                     | YES         | null                                         |
| public       | resource_composition | 6                | quantity_basis          | text                     | YES         | null                                         |
| public       | resource_composition | 7                | recoverable             | boolean                  | NO          | true                                         |
| public       | resource_composition | 8                | data_status             | text                     | YES         | null                                         |
| public       | resource_composition | 9                | evidence_reference      | text                     | YES         | null                                         |
| public       | resource_composition | 10               | confidence              | numeric                  | YES         | null                                         |
| public       | resource_composition | 11               | notes                   | text                     | YES         | null                                         |
| public       | resource_composition | 12               | sort_order              | integer                  | NO          | 1                                            |
| public       | resource_composition | 13               | created_at              | timestamp with time zone | NO          | now()                                        |
| public       | resource_composition | 14               | updated_at              | timestamp with time zone | NO          | now()                                        |
| public       | resource_links       | 1                | id                      | bigint                   | NO          | nextval('resource_links_id_seq'::regclass)   |
| public       | resource_links       | 2                | resource_id             | bigint                   | NO          | null                                         |
| public       | resource_links       | 3                | title                   | text                     | YES         | null                                         |