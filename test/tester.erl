%#!/usr/bin/env escript
%%! -sname server1 +A1 +K true -pa /home/svahne/git/sockjs-erlang/ebin /home/svahne/git/sockjs-erlang/deps/cowboy/ebin -input

-module(tester).
-mode(compile).

-export([main/1, go/0, run/1, run/0]).
-export([start_proxy/2]).
-export([init/3, handle/2, terminate/2]).

%When started as escript
main(_) ->
    ?MODULE:go(),
    receive
        _ -> ok
    end.

%When compiled and started from shell
go()->
    Port = 8081,
    application:start(sockjs),
    application:start(cowboy),

    State = sockjs_handler:init_state(<<"/dist">>, fun dist/2, []),

    Routes = [{'_', 
              [{[<<"dist">>, '...'], sockjs_cowboy_handler, State},
               {'_', ?MODULE, []}
              ]}],

    cowboy:start_listener(http, 100,
                          cowboy_tcp_transport, [{port,     Port}],
                          cowboy_http_protocol, [{dispatch, Routes}]),

    io:format("~n~p: Web server started, try http://localhost:~p/index.html~n"
              "~p can be reached through 'erl -sname remsh -remsh server1@myhost'~n"
              "run tests with e.g: tester:run([array_SUITE, random_SUITE]).~n",
              [node(), Port, node()]).


%% --------------------------------------------------------------------------
%% Cowboy callbacks
%% --------------------------------------------------------------------------

init({_Any, http}, Req, []) ->
    {ok, Req, []}.

terminate(_Req, _State) ->
    ok.

handle(Req, SockjsState) ->
  case cowboy_http_req:path(Req) of
    {File, Req1} when File =:= [<<"term">>,<<"term.js">>];
                  File =:= [<<"index.html">>];
                  File =:= [<<"test_main.js">>];
                  File =:= [<<"browserl.js">>];
                  File =:= [<<"vbarray.vbscript">>];
                  File =:= [<<"hapint">>,<<"hapint.es">>];
                  File =:= [<<"sockjs">>,<<"sockjs-0.2.min.js">>];
                  File =:= [<<"zlib">>,<<"zlib.js">>];
                  File =:= [<<"beams">>,<<"start.boot">>];
                  File =:= [<<"beams">>,<<"beamfiles.tar">>];
                  File =:= [<<"jquery">>,<<"jquery-1.7.1.min.js">>] ->
            {ok, Data} = file:read_file(filename:join([<<"..">>]++File)),
            {ok, Req2} = cowboy_http_req:reply(200, 
                                               [{<<"Content-Type">>, "text/html"}], 
                                               Data, Req1),
            {ok, Req2, SockjsState};
    {[<<"favicon.ico">>], Req1} ->
            cowboy_http_req:reply(404, [{<<"Content-Type">>, "text/html"}], 
                                  "Not Found", Req),
            {ok, Req1, SockjsState};
    Any ->
            io:format("Request for unknown file:~p~n", [Any]),
            cowboy_http_req:reply(404, [{<<"Content-Type">>, "text/html"}], 
                                  "Not Found", Req),
            {ok, Req, SockjsState}
    end.


%% --------------------------------------------------------------------------
%% sockjs Distribution callbacks
%% --------------------------------------------------------------------------
%
% We initiate connection with: {{97, myname}}
% browser responds with: {{97, hisname}}
% to which we reply with: {{98, proxypid}}

dist(Conn, {recv, Data}) -> 
   Term = try binary_to_term(base64:decode(Data)) 
          catch _:_ -> Data
          end,
%   io:format("from browser: ~p ~n",[Term]),
   case Term of
     {2, Pid, Msg} -> Pid ! Msg;
     {6, {RegName, Node}, Msg} -> {RegName, Node} ! Msg; 
     {97, Browser} ->
         Name = atom_to_list(Browser),
         Proxy = spawn(?MODULE, start_proxy, [Conn, Name]),
         send({{98, Proxy}}, Conn);
     _ -> io:format("recv unknown: ~p ~n",[Term])
   end;

dist(Conn, closed) -> 
   io:format("closed sockjs ~p~n",[Conn]);

dist(Conn, init) -> 
   io:format("opened sockjs ~p~n",[Conn]),
   send({{97, node()}}, Conn).

send(Msg, Conn) -> 
   sockjs:send(base64:encode(term_to_binary(Msg)), Conn). 


%% --------------------------------------------------------------------------
%% Distribution proxy
%% --------------------------------------------------------------------------

-define(shutdown(Data), erlang:exit({?MODULE, ?LINE, Data})).

-define(int16(X), [((X) bsr 8) band 16#ff, (X) band 16#ff]).

-define(int32(X), 
        [((X) bsr 24) band 16#ff, ((X) bsr 16) band 16#ff,
         ((X) bsr 8) band 16#ff, (X) band 16#ff]).
-define(u16(X1,X0),
        (((X1) bsl 8) bor (X0))).

-define(u32(X3,X2,X1,X0),
        (((X3) bsl 24) bor ((X2) bsl 16) bor ((X1) bsl 8) bor (X0))).

-define(send(S,D),  
	  begin
                  io:format("~p send ~p ~p~n", [self(), S,D]),
		  gen_tcp:send(S,D) 
	  end).
-define(recv(S), 
	  begin 
		  R = receive  
                        {tcp, _S, D} -> {ok, D};
                         %% Remove later
                         Other -> io:format("unexpected ~p~n",[Other]) 
                      end, 
                  io:format("~p recv ~p ~p~n", [self(),S,R]),
                  R
	  end).

start_proxy(Conn, Browser)->
  Node = node(),
  SetupTime = 30000,
  [Name, Address] = re:split(atom_to_list(Node),"@",[{return, list}]),
  case inet:getaddr(Address, inet) of
    {ok, Ip} ->
       Timer = dist_util:start_timer(SetupTime),
       case erl_epmd:port_please(Name, Ip) of
	 {port, Port, Version} ->
	    dist_util:reset_timer(Timer),
            case gen_tcp:connect(Ip, Port, [{active, true}, {packet,2}]) of
               {ok, Socket} ->
                  handshake(Node, Version, Socket, Timer, Browser),
                  proxy_loop(Conn, Socket);
                _ ->
	          io:format("Failed to connect, bailing out")
	    end;
         _ ->
	   io:format("This node is not registered in epmd, bailing out")
         end;
     _ ->
        io:format("Failed to resolve hostname, bailing out")
  end.

proxy_loop(Conn, Socket)->
  receive
    {error, E} ->
       io:format("error ~p, closing down~n",[E]);
    {tcp, Socket, [112 | Data]} ->
       Bin = list_to_binary(Data),
       Control = binary_to_term(Bin),
       Size = size(term_to_binary(Control)),
       Msg = case Size < size(Bin) of
           true -> 
              <<_:(Size)/bytes, Rest/binary >> = Bin,
              binary_to_term(Rest);
           _ -> ""
       end,   
%       io:format("from erts ~p~n",[{Control, Msg}]),
       sockjs:send(base64:encode(term_to_binary({Control, Msg})), Conn),
       proxy_loop(Conn, Socket);
    {tcp, Socket, []} ->
       sockjs:send(base64:encode(term_to_binary({{99, self()}})), Conn),
       proxy_loop(Conn, Socket);
    {ping} ->
       gen_tcp:send(Socket, <<>>),
       proxy_loop(Conn, Socket);
      D ->
       io:format("unexpected ~p~n",[D]),
       proxy_loop(Conn, Socket)
   end.

handshake(Node, OtherVersion, Socket, Timer, ThisNode) -> 
    Flags = make_flags(Node),
    send_name(Socket, ThisNode, Flags, OtherVersion),
    recv_status(whereis(net_kernel), Socket, Node),
    {_PreOtherFlags,ChallengeA} = recv_challenge(Socket, Node, OtherVersion),
%    {ThisFlags,OtherFlags} = adjust_flags(PreThisFlags, PreOtherFlags),
%    NewHSData = HSData#hs_data{this_flags = ThisFlags,
%                               other_flags = OtherFlags, 
%                               other_started = false}, 
%    check_dflag_xnc(NewHSData),
    MyChallenge = gen_challenge(),
    Cookie = auth:get_cookie(Node),
    send_challenge_reply(Socket,MyChallenge, gen_digest(ChallengeA,Cookie)),
    dist_util:reset_timer(Timer),
    recv_challenge_ack(Socket, Node, MyChallenge, Cookie),
    dist_util:cancel_timer(Timer).


send_name(Socket, Node, Flags, Version) ->
    ?send(Socket, [$n, ?int16(Version), ?int32(Flags), Node]).

send_challenge_reply(Socket, Challenge, Digest) ->
    ?send(Socket, [$r, ?int32(Challenge), Digest]).

send_status(Socket, Stat) ->
    ?send(Socket, [$s | atom_to_list(Stat)]).

recv_status(Kernel, Socket, Node) ->
    case ?recv(Socket) of
        {ok, [$s|StrStat]} ->
            Stat = list_to_atom(StrStat),
            case Stat of
                alive -> 
                    Reply = is_pending(Kernel, Node),
                    send_status(Socket, Reply),
                    if not Reply ->
                            ?shutdown(Node);
                       Reply ->
                            Stat
                    end;
                _ -> Stat
            end;
        _Error ->
           ok
    end.

recv_challenge(Socket, Node, Version) ->
    case ?recv(Socket) of
        {ok,[$n,V1,V0,Fl1,Fl2,Fl3,Fl4,CA3,CA2,CA1,CA0 | Ns]} ->
            Flags = ?u32(Fl1,Fl2,Fl3,Fl4),
            try {list_to_existing_atom(Ns),?u16(V1,V0)} of
                {Node,Version} ->
                    Challenge = ?u32(CA3,CA2,CA1,CA0),
                    {Flags,Challenge};
                _ ->
                    ?shutdown(no_node)
            catch
                error:badarg ->
                    ?shutdown(no_node)
            end;
        _ ->
            ?shutdown(no_node)      
    end.

recv_challenge_ack(Socket, NodeB, ChallengeB, CookieA) ->
    case ?recv(Socket) of
        {ok,[$a|SumB]} when length(SumB) =:= 16 ->
            SumA = gen_digest(ChallengeB, CookieA),
            case list_to_binary(SumB) of
                SumA ->
                    ok;
                _ ->
                    io:format("** Connection attempt to "
                              "disallowed node ~w ** ~n", [NodeB]),
                    ?shutdown(NodeB)
            end;
        _ ->
            ?shutdown(NodeB)
    end.



gen_challenge() ->
    {A,B,C} = erlang:now(),
    {D,_}   = erlang:statistics(reductions),
    {E,_}   = erlang:statistics(runtime),
    {F,_}   = erlang:statistics(wall_clock),
    {G,H,_} = erlang:statistics(garbage_collection),
    %% A(8) B(16) C(16)
    %% D(16),E(8), F(16) G(8) H(16)
    ( ((A bsl 24) + (E bsl 16) + (G bsl 8) + F) bxor
      (B + (C bsl 16)) bxor 
      (D + (H bsl 16)) ) band 16#ffffffff.


gen_digest(Challenge, Cookie) when is_integer(Challenge), is_atom(Cookie) ->
    erlang:md5([atom_to_list(Cookie)|integer_to_list(Challenge)]).

is_pending(Kernel, Node) ->
    Kernel ! {self(), {is_pending, Node}},
    receive
        {Kernel, {is_pending, Reply}} -> Reply
    end.

-define(DFLAG_PUBLISHED,1).
%-define(DFLAG_ATOM_CACHE,2).
-define(DFLAG_EXTENDED_REFERENCES,4).
-define(DFLAG_DIST_MONITOR,8).
%-define(DFLAG_FUN_TAGS,16#10).
%-define(DFLAG_DIST_MONITOR_NAME,16#20).
%-define(DFLAG_HIDDEN_ATOM_CACHE,16#40).
%-define(DFLAG_NEW_FUN_TAGS,16#80).
-define(DFLAG_EXTENDED_PIDS_PORTS,16#100).
%-define(DFLAG_EXPORT_PTR_TAG,16#200).
%-define(DFLAG_BIT_BINARIES,16#400).
%-define(DFLAG_NEW_FLOATS,16#800).
%-define(DFLAG_UNICODE_IO,16#1000).
%-define(DFLAG_DIST_HDR_ATOM_CACHE,16#2000).
%-define(DFLAG_SMALL_ATOM_TAGS, 16#4000).

make_flags(OtherNode) ->
    P = case net_kernel:publish_on_node(OtherNode) of
        true ->
            ?DFLAG_PUBLISHED;
        _ ->
            0
    end,
    P bor %?DFLAG_EXPORT_PTR_TAG bor
          ?DFLAG_DIST_MONITOR bor
%          ?DFLAG_FUN_TAGS bor
%          ?DFLAG_DIST_MONITOR_NAME bor
%          ?DFLAG_HIDDEN_ATOM_CACHE bor
%          ?DFLAG_NEW_FUN_TAGS bor
%          ?DFLAG_BIT_BINARIES bor
%          ?DFLAG_NEW_FLOATS bor
%          ?DFLAG_UNICODE_IO bor
%         ?DFLAG_DIST_HDR_ATOM_CACHE bor
%          ?DFLAG_SMALL_ATOM_TAGS bor
          ?DFLAG_EXTENDED_PIDS_PORTS bor
          ?DFLAG_EXTENDED_REFERENCES.


%% --------------------------------------------------------------------------
%% Functions for running common test
%% --------------------------------------------------------------------------
run() -> 
   ct_master:run("browserl.spec", true, nodes(), []).

run(Suites) ->
   ct_master:run_test(hd(nodes()), 
                      [{suite,Suites},
                       {auto_compile, false}, 
                       {basic_html, true}, 
                       batch,
                       {event_handler, master, logger}]).