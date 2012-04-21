{event_handler, master, logger}.
{multiply_timetraps, all_nodes, 109}.

{suites, all_nodes, "/tmp", supervisor_SUITE}. % cancel timeout todo?
{suites, all_nodes, "/tmp", gen_event_SUITE}.
{suites, all_nodes, "/tmp", gen_fsm_SUITE}. % termToStr & global (start7)
{suites, all_nodes, "/tmp", gen_server_SUITE}. % cast to other node (cast_fast)


% Completed with no errors
{suites, all_nodes, "/tmp", queue_SUITE}.
{suites, all_nodes, "/tmp", format_SUITE}.
{suites, all_nodes, "/tmp", array_SUITE}.
{suites, all_nodes, "/tmp", lists_SUITE}.
{suites, all_nodes, "/tmp", random_SUITE}.

% Completed but with errors
{suites, all_nodes, "/tmp", sofs_SUITE}. %23
{suites, all_nodes, "/tmp", erl_scan_SUITE}. %2
{suites, all_nodes, "/tmp", sets_SUITE}. %3
{suites, all_nodes, "/tmp", calendar_SUITE}. %1
{suites, all_nodes, "/tmp", edlin_expand_SUITE}. %skipped 4
{suites, all_nodes, "/tmp", epp_SUITE}.%21
{suites, all_nodes, "/tmp", ets_tough_SUITE}. %1
{suites, all_nodes, "/tmp", stdlib_SUITE}. %1
{suites, all_nodes, "/tmp", string_SUITE}. %2
{suites, all_nodes, "/tmp", supervisor_bridge_SUITE}. %2
{suites, all_nodes, "/tmp", unicode_SUITE}. %5
{suites, all_nodes, "/tmp", y2k_SUITE}. %7
{suites, all_nodes, "/tmp", ms_transform_SUITE}. %15
{suites, all_nodes, "/tmp", proc_lib_SUITE}. %4
{suites, all_nodes, "/tmp", select_SUITE}. %2
{suites, all_nodes, "/tmp", slave_SUITE}. %4
{suites, all_nodes, "/tmp", filename_SUITE}. %12
{suites, all_nodes, "/tmp", timer_simple_SUITE}. %11


% 134 70
% 182 107
% 189 118

% Hangs emu
%{suites, all_nodes, "/tmp", digraph_SUITE}. % improper list
%{suites, all_nodes, "/tmp", digraph_utils_SUITE}. % improper list

%{suites, all_nodes, "/tmp", base64_SUITE}. % missing opcode bs_init_writable
%{suites, all_nodes, "/tmp", erl_pp_SUITE}. % missing opcode "is_bitstr"
%{suites, all_nodes, "/tmp", io_proto_SUITE}. % missing opcode bs_skip_utf8

%{suites, all_nodes, "/tmp", log_mf_h_SUITE}. % unknown port_command
%{suites, all_nodes, "/tmp", tar_SUITE}. % unknown port_command

%{suites, all_nodes, "/tmp", re_SUITE}. % malformed js regexp

%{suites, all_nodes, "/tmp", zip_SUITE}.
%{suites, all_nodes, "/tmp", sys_SUITE}. 


% Not yet tested
%{suites, all_nodes, "/tmp", binary_module_SUITE}.
%{suites, all_nodes, "/tmp", erl_eval_SUITE}.
%{suites, all_nodes, "/tmp", ets_SUITE}.
%{suites, all_nodes, "/tmp", file_sorter_SUITE}.
%{suites, all_nodes, "/tmp", shell_SUITE}.
%{suites, all_nodes, "/tmp", io_SUITE}.


% Depending on compiler app
%{suites, all_nodes, "/tmp", erl_expand_records_SUITE}.
%{suites, all_nodes, "/tmp", erl_internal_SUITE}.
%{suites, all_nodes, "/tmp", erl_lint_SUITE}.
%{suites, all_nodes, "/tmp", c_SUITE}.
%{suites, all_nodes, "/tmp", id_transform_SUITE}.
%{suites, all_nodes, "/tmp", qlc_SUITE}.

% time traps
%{suites, all_nodes, "/tmp", dict_SUITE}.
%{suites, all_nodes, "/tmp", timer_SUITE}.

% Not expected to work due to limititations in browsers
%{suites, all_nodes, "/tmp", dets_SUITE}.
%{suites, all_nodes, "/tmp", filelib_SUITE}.
%{suites, all_nodes, "/tmp", fixtable_SUITE}. % depending on dets
%{suites, all_nodes, "/tmp", win32reg_SUITE}.
