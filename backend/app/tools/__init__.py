from app.tools.registry import registry
from app.tools.campus_tools import (
    GetStudentProfileTool,
    GetAttendanceTool,
    GetCourseScheduleTool,
    GetLeavePolicyTool,
    CheckLeaveEligibilityTool,
    CreateLeaveApplicationTool,
    GetLeaveApplicationStatusTool,
    GetStudentAcademicSummaryTool,
    GetHostelStatusTool,
    SubmitHostelServiceRequestTool,
    GetFeeStatusTool,
    CreateSupportTicketTool,
    QueryCampusPolicyTool,
    GetExaminationScheduleTool,
)

def register_all_tools():
    # Core existing tools
    registry.register(GetStudentProfileTool())
    registry.register(GetAttendanceTool())
    registry.register(GetCourseScheduleTool())
    registry.register(GetLeavePolicyTool())
    registry.register(CheckLeaveEligibilityTool())
    registry.register(CreateLeaveApplicationTool())
    registry.register(GetLeaveApplicationStatusTool())

    # Extended operational campus tools
    registry.register(GetStudentAcademicSummaryTool())
    registry.register(GetHostelStatusTool())
    registry.register(SubmitHostelServiceRequestTool())
    registry.register(GetFeeStatusTool())
    registry.register(CreateSupportTicketTool())
    registry.register(QueryCampusPolicyTool())
    registry.register(GetExaminationScheduleTool())

register_all_tools()
