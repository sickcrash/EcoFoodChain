export interface Permission {
is_a_team_member: boolean;
fake: boolean;
max_chart_history: number;
_id: string;
user_id?: string;
team_id?: string;
roles: string;
member_team_role?: string;
member_team_id?: string;
}

export interface DashboardModel {
_id: string;
widgets: string[];
report: boolean;
template: boolean;
containsTemplates: boolean;
description: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
child: any[];
permissions: Permission[];
category: string;
parent: string | null;
root: string | null;
}
