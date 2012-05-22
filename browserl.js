'use strict';

// An erlang emulator written in javascript
// Copyright (C) 2012, Fredrik Svahn
//
//  Dual licensed under the MIT and GPLv3 licenses
//
//
//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License as published by
//  the Free Software Foundation, either version 3 of the License, or
//  (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.
//
//  For the license terms under the MIT license, see MIT-LICENSE

//TODO list:
//-----------
//binaries, really a hack at the moment
//ets tables, just a hack to get things working
//file ops, just a hack
//checking args for bifs
//TODO distribution
//hard coded paths in tester.erl
//net_kernel in browser not aware of connection
//global in browser not updated about nodedown from other browsers

//known BUGs
//-----------
//initial calls sometimes have proc_lib as initial call in i().
//lists:reverse(a) ==problem with binary matching in lib@3479


/*
dbg:start(), dbg:tracer(), dbg:tpl(, '_', []). 
dbg:p(all, c).
dbg:stop_clear().

dbg:tpl(math, sum, dbg:fun2ms(fun(_) -> return_trace() end)).
*/


var OpcodeNames = ['NOP','label/1','func_info/3','int_code_end/0','call/2','call_last/3','call_only/2','call_ext/2','call_ext_last/3','bif0/2','bif1/4',
'bif2/5','allocate/2','allocate_heap/3','allocate_zero/2','allocate_heap_zero/3','test_heap/2','init/1','deallocate/1','return/0','send/0',
'remove_message/0','timeout/0','loop_rec/2','loop_rec_end/1','wait/1','wait_timeout/2','m_plus/4','m_minus/4','m_times/4','m_div/4','int_div/4',
'int_rem/4','int_band/4','int_bor/4','int_bxor/4','int_bsl/4','int_bsr/4','int_bnot/3','is_lt/3','is_ge/3','is_eq/3','is_ne/3','is_eq_exact/3',
'is_ne_exact/3','is_integer/2','is_float/2','is_number/2','is_atom/2','is_pid/2','is_reference/2','is_port/2','is_nil/2','is_binary/2','is_constant/2',
'is_list/2','is_nonempty_list/2','is_tuple/2','test_arity/3','select_val/3','select_tuple_arity/3','jump/1','catch/2','catch_end/1','move/2','get_list/3',
'get_tuple_element/3','set_tuple_element/3','put_string/3','put_list/3','put_tuple/2','put/1','badmatch/1','if_end/0','case_end/1',
'call_fun/1','make_fun/3','is_function/2','call_ext_only/2','bs_start_match/2','bs_get_integer/5','bs_get_float/5','bs_get_binary/5',
'bs_skip_bits/4','bs_test_tail/2','bs_save/1','bs_restore/1','bs_init/2','bs_final/2','bs_put_integer/5','bs_put_binary/5','bs_put_float/5',
'bs_put_string/2','bs_need_buf/1','fclearerror/0','fcheckerror/1','fmove/2','fconv/2','fadd/4','fsub/4','fmul/4','fdiv/4','fnegate/3','make_fun2/1',
'try/2','try_end/1','try_case/1','try_case_end/1','raise/2','bs_init2/6','bs_bits_to_bytes/3','bs_add/5','apply/1','apply_last/2','is_boolean/2',
'is_function2/3','bs_start_match2/5','bs_get_integer2/7','bs_get_float2/7','bs_get_binary2/7','bs_skip_bits2/5','bs_test_tail2/3','bs_save2/2',
'bs_restore2/2','gc_bif1/5','gc_bif2/6','bs_final2/2','bs_bits_to_bytes2/2','put_literal/2','is_bitstr/2','bs_context_to_binary/1','bs_test_unit/3',
'bs_match_string/4','bs_init_writable/0','bs_append/8','bs_private_append/6','trim/2','bs_init_bits/6','bs_get_utf8/5','bs_skip_utf8/4','bs_get_utf16/5',
'bs_skip_utf16/4','bs_get_utf32/5','bs_skip_utf32/4','bs_utf8_size/3','bs_put_utf8/3','bs_utf16_size/3','bs_put_utf16/3','bs_put_utf32/3',
'on_load/0','recv_mark/1','recv_set/1','gc_bif3/7'];

var ArityTable = [0,1,3,0,2,3,2,2,3,2,4,5,2,3,2,3,2,1,1,0,0,0,0,2,1,1,2,4,4,4,4,4,4,4,4,4,4,4,3,3,3,3,3,3,3,2,2,2,2,2,2,2,2,2,2,2,2,2,3,3,3,1,2,1,2,3,3,3,3,3,2,1,1,0,1,1,3,2,2,2,5,5,5,4,2,1,1,2,2,5,5,5,2,1,0,1,2,2,4,4,4,4,3,1,2,1,1,1,2,6,3,5,1,2,2,3,5,7,7,7,5,3,2,2,5,6,2,2,2,2,1,3,4,0,8,6,2,6,5,4,5,4,5,4,3,3,3,3,3,0,1,1,7];

var Modules = [];

//
// START OF LOADER CODE
//

//The atom table used during initial code load
var h_atom = (2 << 27) + 1;
var loaderAtomTable = {};

function loaderStrToAtom(str){
  var atom = loaderAtomTable[str];
  if (atom != undefined) return atom; 
  loaderAtomTable[str] = h_atom;
  return h_atom++;
}

//atom constants
var am_true = loaderStrToAtom('true');
var am_false = loaderStrToAtom('false');
var am_erlang = loaderStrToAtom('erlang');
var am_self = loaderStrToAtom('self');
var am_node = loaderStrToAtom('node');
var am_ok = loaderStrToAtom('ok');
var am_round = loaderStrToAtom('round');
var am_float = loaderStrToAtom('float');
var am_size = loaderStrToAtom('size');
var am_byte_size = loaderStrToAtom('byte_size');
var am_bit_size = loaderStrToAtom('bit_size');
var am_length = loaderStrToAtom('length');
var am_abs = loaderStrToAtom('abs');
var am_trunc = loaderStrToAtom('trunc');
var am_is_port = loaderStrToAtom('is_port');
var am_is_number = loaderStrToAtom('is_number');
var am_is_integer = loaderStrToAtom('is_integer');
var am_is_list = loaderStrToAtom('is_list');
var am_is_tuple = loaderStrToAtom('is_tuple');
var am_is_atom = loaderStrToAtom('is_atom');
var am_is_pid = loaderStrToAtom('is_pid');
var am_is_binary = loaderStrToAtom('is_binary');
var am_is_boolean = loaderStrToAtom('is_boolean');
var am_tuple_size = loaderStrToAtom('tuple_size');
var am_not = loaderStrToAtom('not');
var am_hd = loaderStrToAtom('hd');
var am_tl = loaderStrToAtom('tl');
var am_get = loaderStrToAtom('get');
var am_element = loaderStrToAtom('element');
var am_and = loaderStrToAtom('and');
var am_or = loaderStrToAtom('or');
var am_apply = loaderStrToAtom('apply');
var am_yield = loaderStrToAtom('yield');
var am_os = loaderStrToAtom('os');
var am_band = loaderStrToAtom('band');
var am_bsr = loaderStrToAtom('bsr');
var am_bsl = loaderStrToAtom('bsl');
var am_bor = loaderStrToAtom('bor');
var am_bxor = loaderStrToAtom('bxor');

var am_timestamp = loaderStrToAtom('timestamp');
var am_getenv = loaderStrToAtom('getenv');
var am_putenv = loaderStrToAtom('putenv');
var am_ets = loaderStrToAtom('ets');
var am_lists = loaderStrToAtom('lists');
var am_unicode = loaderStrToAtom('unicode');
var am_error_logger = loaderStrToAtom('error_logger');
var am_prim_file = loaderStrToAtom('prim_file');
var am_net_kernel = loaderStrToAtom('net_kernel');
var am_setnode = loaderStrToAtom('setnode');
var am_code = loaderStrToAtom('code');
var am_file = loaderStrToAtom('file');
var am_math = loaderStrToAtom('math');
var am_badarg = loaderStrToAtom('badarg');
var am_badarity = loaderStrToAtom('badarity');

var am_delete_object = loaderStrToAtom('delete_object');
var am_new = loaderStrToAtom('new');
var am_delete = loaderStrToAtom('delete');
var am_delete = loaderStrToAtom('delete');
var am_select_delete = loaderStrToAtom('select_delete');
var am_select = loaderStrToAtom('select');
var am_insert = loaderStrToAtom('insert');
var am_lookup = loaderStrToAtom('lookup');
var am_lookup_element = loaderStrToAtom('lookup_element');
var am_slot = loaderStrToAtom('slot');
var am_first = loaderStrToAtom('first');
var am_next = loaderStrToAtom('next');
var am_all = loaderStrToAtom('all');
var am_info = loaderStrToAtom('info');
var am_match = loaderStrToAtom('match');
var am_match_object = loaderStrToAtom('match_object');
var am_member = loaderStrToAtom('member');
var am_keysearch = loaderStrToAtom('keysearch');
var am_keyfind = loaderStrToAtom('keyfind');
var am_keymember = loaderStrToAtom('keymember');
var am_reverse = loaderStrToAtom('reverse');
var am_bin_is_7bit = loaderStrToAtom('bin_is_7bit');
var am_characters_to_binary = loaderStrToAtom('characters_to_binary');
var am_characters_to_list = loaderStrToAtom('characters_to_list');
var am_warning_map = loaderStrToAtom('warning_map');
var am_dflag_unicode_io = loaderStrToAtom('dflag_unicode_io');
var am_internal_native2name = loaderStrToAtom('internal_native2name');
var am_internal_name2native = loaderStrToAtom('internal_name2native');
var am_get_chunk = loaderStrToAtom('get_chunk');
var am_native_name_encoding = loaderStrToAtom('native_name_encoding');
var am_log10 = loaderStrToAtom('log10');
var am_log = loaderStrToAtom('log');
var am_now = loaderStrToAtom('now');
var am_date = loaderStrToAtom('date');
var am_universaltime_to_localtime = loaderStrToAtom('universaltime_to_localtime');
var am_localtime = loaderStrToAtom('localtime');
var am_time = loaderStrToAtom('time');
var am_universaltime_to_localtime = loaderStrToAtom('universaltime_to_localtime');
var am_statistics = loaderStrToAtom('statistics');
var am_div = loaderStrToAtom('div');
var am_rem = loaderStrToAtom('rem');
var am_group_leader = loaderStrToAtom('group_leader');
var am_group_leader = loaderStrToAtom('group_leader');
var am_garbage_collect = loaderStrToAtom('garbage_collect');
var am_cancel_timer = loaderStrToAtom('cancel_timer');
var am_memory = loaderStrToAtom('memory');
var am_registered = loaderStrToAtom('registered');
var am_processes = loaderStrToAtom('processes');
var am_list_to_pid = loaderStrToAtom('list_to_pid');
var am_pid_to_list = loaderStrToAtom('pid_to_list');
var am_port_to_list = loaderStrToAtom('port_to_list');
var am_fun_to_list = loaderStrToAtom('fun_to_list');
var am_fun_info = loaderStrToAtom('fun_info');
var am_register = loaderStrToAtom('register');
var am_unregister = loaderStrToAtom('unregister');
var am_list_to_float = loaderStrToAtom('list_to_float');
var am_float_to_list = loaderStrToAtom('float_to_list');
var am_make_tuple = loaderStrToAtom('make_tuple');
var am_whereis = loaderStrToAtom('whereis');
var am_self = loaderStrToAtom('self');
var am_process_info = loaderStrToAtom('process_info');
var am_process_display = loaderStrToAtom('process_display');
var am_is_alive = loaderStrToAtom('is_alive');
var am_process_flag = loaderStrToAtom('process_flag');
var am_get_module_info = loaderStrToAtom('get_module_info');
var am_get_module_info = loaderStrToAtom('get_module_info');
var am_system_info = loaderStrToAtom('system_info');
var am_pre_loaded = loaderStrToAtom('pre_loaded');
var am_module_loaded = loaderStrToAtom('module_loaded');
var am_load_module = loaderStrToAtom('load_module');
var am_function_exported = loaderStrToAtom('function_exported');
var am_make_ref = loaderStrToAtom('make_ref');
var am_iolist_size = loaderStrToAtom('iolist_size');
var am_list_to_integer = loaderStrToAtom('list_to_integer');
var am_integer_to_list = loaderStrToAtom('integer_to_list');
var am_iolist_to_binary = loaderStrToAtom('iolist_to_binary');
var am_nodes = loaderStrToAtom('nodes');
var am_open_port = loaderStrToAtom('open_port');
var am_port_command = loaderStrToAtom('port_command');
var am_port_control = loaderStrToAtom('port_control');
var am_port_connect = loaderStrToAtom('port_connect');
var am_port_close = loaderStrToAtom('port_close');
var am_monitor = loaderStrToAtom('monitor');
var am_demonitor = loaderStrToAtom('demonitor');
var am_is_process_alive = loaderStrToAtom('is_process_alive');
var am_link = loaderStrToAtom('link');
var am_unlink = loaderStrToAtom('unlink');
var am_display = loaderStrToAtom('display');
var am_bump_reductions = loaderStrToAtom('bump_reductions');
var am_get_stacktrace = loaderStrToAtom('get_stacktrace');
var am_exit = loaderStrToAtom('exit');
var am_error = loaderStrToAtom('error');
var am_throw = loaderStrToAtom('throw');
var am_raise = loaderStrToAtom('raise');
var am_atom_to_list = loaderStrToAtom('atom_to_list');
var am_term_to_binary = loaderStrToAtom('term_to_binary');
var am_binary_to_term = loaderStrToAtom('binary_to_term');
var am_setelement = loaderStrToAtom('setelement');
var am_list_to_tuple = loaderStrToAtom('list_to_tuple');
var am_tuple_to_list = loaderStrToAtom('tuple_to_list');
var am_list_to_binary = loaderStrToAtom('list_to_binary');
var am_ref_to_list = loaderStrToAtom('ref_to_list');
var am_send = loaderStrToAtom('send');
var am_send_after = loaderStrToAtom('send_after');
var am_list_to_atom = loaderStrToAtom('list_to_atom');
var am_binary_to_list = loaderStrToAtom('binary_to_list');
var am_phash = loaderStrToAtom('phash');
var am_put = loaderStrToAtom('put');
var am_get = loaderStrToAtom('get');
var am_get = loaderStrToAtom('get');
var am_erase = loaderStrToAtom('erase');
var am_make_fun = loaderStrToAtom('make_fun');
var am_spawn_opt = loaderStrToAtom('spawn_opt');
var am_spawn = loaderStrToAtom('spawn');
var am_spawn_link = loaderStrToAtom('spawn_link');
var am_nonode_nohost = loaderStrToAtom('nonode@nohost');
var am_pid = loaderStrToAtom('pid');
var am_eval = loaderStrToAtom('eval');
var am_get = loaderStrToAtom('get');
var am_set = loaderStrToAtom('set');
var am_call = loaderStrToAtom('call');
var am_js = loaderStrToAtom('js');
var am_browserl_dist = loaderStrToAtom('browserl_dist');
var am_listen = loaderStrToAtom('listen');
var am_accept = loaderStrToAtom('accept');
var am_childspecs = loaderStrToAtom('childspecs');
var am_re = loaderStrToAtom('re');
var am_run = loaderStrToAtom('run');

//special characters
var am_sign_minus = loaderStrToAtom('-');
var am_sign_equal_exact = loaderStrToAtom('=:=');
var am_sign_not_equal_exact = loaderStrToAtom('=/=');
var am_sign_equal = loaderStrToAtom('==');
var am_sign_gt = loaderStrToAtom('>');
var am_sign_lt = loaderStrToAtom('<');
var am_sign_gte = loaderStrToAtom('>=');
var am_sign_lte = loaderStrToAtom('=<');
var am_sign_not_equal = loaderStrToAtom('/=');
var am_sign_assign = loaderStrToAtom('=');
var am_sign_plus = loaderStrToAtom('+');
var am_sign_minus = loaderStrToAtom('-');
var am_sign_multiply = loaderStrToAtom('*');
var am_sign_divide = loaderStrToAtom('/');
var am_sign_exclamation = loaderStrToAtom('!');
var am_sign_plusplus = loaderStrToAtom('++');
var am_sign_minusminus = loaderStrToAtom('--');


//Thanks IE
if (!Date.now) {
  Date.now = function() {
    return +new Date;
  }
}

//Common interface for extracting data from an Uint8Array, array or a string
if (window.Uint8Array) {
  Uint8Array.prototype.getString = function(pos, len) {
    var s = '', i;
    for (i = 0; i < len; i++) {
      s += String.fromCharCode(this[pos+i]);
    }
    return s;
  }

  Uint8Array.prototype.getZeroTerminatedString = function(pos, maxlen) {
    var s = '', c, i = 0;
    while (i < maxlen) {
      c = this[pos+(i++)];
      if (c == 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }

  Uint8Array.prototype.getByte = function(pos) { 
    return this[pos]; 
  }

  Uint8Array.prototype.getInt32 = function(pos) {
    return (this[pos]<<24) + (this[pos+1]<<16) + (this[pos+2]<<8) + this[pos+3];
  }
}

Array.prototype.getString = function(pos, len) {
  var s = '', i;
  for (i = 0; i < len; i++) {
    s += String.fromCharCode(this[pos+i]);
  }
  return s;
}

Array.prototype.getZeroTerminatedString = function(pos, maxlen) {
  var s = '', c, i = 0;
  while (i < maxlen) {
    c = this[pos+(i++)];
    if (c == 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

Array.prototype.getByte = function(pos) { 
  return this[pos]; 
}

Array.prototype.getInt32 = function(pos) {
  return (this[pos]<<24) + (this[pos+1]<<16) + (this[pos+2]<<8) + this[pos+3];
}

Array.prototype.subarray =function(start, end) {
  //slice does not seem to work for konqueror
  var i, sa = new Array(end-start);
  for (i = start; i < end; i++) sa[i-start] = this[i];
  return sa;
}

String.prototype.getZeroTerminatedString = function(pos, maxlen) {
  var s = '', c, i = 0;
  while (i < maxlen) {
    c = this.charCodeAt(pos+(i++));
    if (c == 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

String.prototype.getByte = function(pos) { 
  return this.charCodeAt(pos)&255; 
}

String.prototype.getInt32 = function(pos) {
  return (this.getByte(pos)<<24) + (this.getByte(pos+1)<<16) + 
         (this.getByte(pos+2)<<8) + this.getByte(pos+3);
}

String.prototype.getString = function(pos, len) {
  var s = '', i;
  for (i = 0; i < len; i++) {
    s += String.fromCharCode(this.getByte(pos+i));
  }
  return s;
}

String.prototype.subarray = function(start, end) {
  var s = [], i;
  for (i = start; i < end; i++) {
    s.push(this.getByte(i));
  }
  return s;
}

//Not using Float64Array since typed arrays are not available on all targets
function arrayToFloat(a, pos) {
  var sign = a.getInt32(pos) >> 31;
  var exponent = ((a.getInt32(pos) >> 20) & ((1 << 11)-1)); 
  var fractionUpper = a.getInt32(pos) & ((1 << 20)-1);	
  var fractionLower = a.getInt32(pos+4);
  var fraction = fractionUpper*0x100000000 + Math.abs(fractionLower);
  var num;
  if (exponent == 0)
    num = Math.pow(2, exponent-1023)*(Math.abs(fraction/(4503599627370496/2))); //1 bsl 51
  else 
    num = Math.pow(2, exponent-1023)*(1+Math.abs(fraction/4503599627370496)); //1 bsl 52
  if (sign == -1) num = -num;
//  debugln1('arrayToFloat:'+sign+':'+exponent+':'+fraction+':'+num);
  return num;
}

function floatToArray(n, bits) { //TODO: handle 32 bits
  var s = (n < 0) ? 1 : 0;
  var e = 0, m = 0;
  n = Math.abs(n);
  if (n != 0) {
    while (n >= 2) {
      e++; 
      n /= 2;
    }
    while (n < 1) {
      e--;
      n *= 2;
    } 
  } else { e = -1023; n = 1;} //TODO handle denormalised numbers
//  console.log("exponent: "+(e+1023)+" mantissa: "+(n-1)*0x10000000000000); //1 bsl 52
  var lower32bits = (n-1)*4503599627370496 & 0xffffffff; //shift mantissa 52 bits and mask out lowest 32
  var higher32bits = ((n-1)*Math.pow(2,20)) & 0xfffff | (Math.abs(e+1023) << 20) | (s << 31);
  return [higher32bits >>> 24, (higher32bits >>> 16) & 0xff, (higher32bits >>> 8) & 0xff, higher32bits & 0xff, 
    lower32bits >>> 24, (lower32bits >>> 16) & 0xff, (lower32bits >>> 8) & 0xff, lower32bits & 0xff];
}

function arrayToTerm(a, loading){
  var pos=1;
  if (a[0] != 131) throw 'not a valid term '+a.charCodeAt(0);
  return decode(a, 1);
  
  function decode() {
    switch(a[pos++]) {
      case 70: //float constant?
        var num = arrayToFloat(a, pos);
	pos += 8; 
	return {type:am_float, value:num}; 
      case 77: //bitstring (used in erl_eval_SUITE, and many more)
	var byte_len = bytesToInteger(a, pos, 4);
	var bits_in_last_byte = bytesToInteger(a, pos+4, 1);
	pos += 4+byte_len+1;
        return {type:'bitstring', value: a.getString(pos-byte_len, byte_len+1), 
                len:byte_len*8+bits_in_last_byte};
      case 97: //small int
	return bytesToInteger(a, pos++, 1);
      case 98: //int
        pos+=4;
	return bytesToInteger(a, pos-4, 4);
      case 100: //atom
	var len = bytesToInteger(a, pos, 2);
	pos += len + 2;
	var atom = a.getString(pos - len, len);
	if (loading) return loaderStrToAtom(atom);
	return strToAtom(atom);
      case 103: //pid_ext
	var node = decode();
	var id = bytesToInteger(a, pos, 4);
	pos += 4;
	var serial = bytesToInteger(a, pos, 4);
	pos += 4;
	var creation = bytesToInteger(a, pos, 1);
	pos += 1;
	if (node == node_name) return {type: am_pid, value: id}
	return {type:am_pid, value:[node, id, serial, creation]};
      case 104: //small tuple
	var len = bytesToInteger(a, pos, 1);
	var tp = [];
	pos += 1; 
	while (len--) { tp.push(decode()); }
	return tp;
      case 106: //nil
        return 2 << 27;
      case 107: //string 
	var len = bytesToInteger(a, pos, 2);
	pos += len + 2;
	return strToList(a.getString(pos - len, len));
      case 108: //list
        var len = bytesToInteger(a, pos, 4);
	var next = 2 << 27;
	pos += 4; 
	while (len--) {
	  var el = decode();
	  next = {value: el, next:next};  
	}
	if (a[pos] != 106) {
	  return listReverse(next, decode());
	}
	pos++;
	return listReverse(next, 2 << 27);
      case 109: 
	var len = bytesToInteger(a, pos, 4);
	pos += 4 + len; 
	return a.getString(pos - len, len);
      case 110: //small big
        var len = bytesToInteger(a, pos, 1);
        var sign = bytesToInteger(a, pos+1, 1);
        var bytes = a.subarray(pos+2, pos+2+len);
	pos += len+2;
	var big = new Math.BigInt("0"), t = Math.BigInt.valueOf(256);  
	for (var i = 0; i<len; i++) {
	  big = big.add(t.pow(i).multiply(Math.BigInt.valueOf(bytes[i]))); 
	} 
	if (sign==1) return big.negate();
	return big;
//      case 112: //fun e.g. fun()-> ok end
//      case 113: //fun e.g. fun io:format/2
      case 114: //external reference
	var len = bytesToInteger(a, pos, 2)*4;
	pos += 2;
	var node = decode();
	var creation = bytesToInteger(a, pos, 1);
	pos += 1; 
	if (node == node_name) {
	  var id = 0;
	  while (len>0) {
	    id = bytesToInteger(a, pos, 4) + id*0xFFFFFFFF;
	    len -= 4;
	    pos += 4;
	  }
	  return {type: "ref", value: id};
	}
	var id = a.getString(pos, len);
	pos += len; 
	return {type:"ref", value:[len/4, node, creation, id]};
      default:
	throw 'unknown type '+a[pos-1]+'at'+(pos-1)+' in arrayToTerm';
    }
  }
  
  function bytesToInteger(a, pos, len) { //TODO handle bignums
    var isNegative, i, n, result = 0;
    isNegative = (a[pos] > 128) && (len > 3);
    for (i = pos; i < pos+len; i++) {
      n = a[i];
      if (isNegative) {
	n = 255 - n;
      }
      result = result * 256 + n;
    }
    return isNegative ? -result - 1: result;
  }
}

function termToBinary(term){
  return termToStrInternal(term, String.fromCharCode(131));
  
  function termToStrInternal(a, res){
    if (is_atom(a)) {
      var str = atomToStr(a);
      res += String.fromCharCode(100);
      res += intToStr(str.length, 2);
      res += str;
    } else if (is_tuple(a)) { //TODO handle tuples larger than 255
      var temp="";
      res += String.fromCharCode(104);
      res += intToStr(a.length, 1);
      for(var i = 0; i < a.length; i++) temp += termToStrInternal(a[i], "");
      res += temp;
    } else if (is_nonempty_list(a)) {
      var len = listLen(a);
      if (len == undefined) len = listLenImproperList(a);
      res += String.fromCharCode(108);
      res += intToStr(len, 4);
      while (a != 2 << 27) { 
	res += termToStrInternal(a.value, "");
	a = a.next;
	if (a.value == undefined) {
	  //improper list
	  res += termToStrInternal(a, "");
	  return res;
	}
      }
      res += String.fromCharCode(106);
    } else if (is_list(a)) {
      res += String.fromCharCode(106);
    } else if (is_integer(a)) { //TODO handle large integers
      if (a >= 0 && a < 256) {
	res += String.fromCharCode(97);
	res += intToStr(a, 1);
      } else if (a > 255 && a < 0xFFFFFFFF) {
	res += String.fromCharCode(98);
	res += intToStr(a, 4);
      } else if (is_bignum(a)) { //HACK
       debugln1("WARNING: encoding bignum not implemented");
      } else if (a < 0) { //HACK
       debugln1("WARNING: encoding negative numbers not implemented");
      } else throw "unknown int in term_to_binary";
    } else if (is_pid(a)) {
      res += String.fromCharCode(103);
      if (is_external_pid(a)) {
	res += termToStrInternal(a.value[0], ""); //node
	res += intToStr(a.value[1], 4); //process id
	res += intToStr(a.value[2], 4); //serial
	res += intToStr(a.value[3], 1); //creation
      } else {
	res += termToStrInternal(node_name, "")
	res += intToStr(a.value, 4);
	res += intToStr(0, 4);
	res += intToStr(3, 1);
      }
    } else if (is_reference(a)) {
	res += String.fromCharCode(114); 
      if (is_external_reference(a)) {
	res += intToStr(a.value[0], 2);
	res += termToStrInternal(a.value[1], "");
	res += intToStr(a.value[2], 1);
	res += a.value[3];
      } else {
	res += intToStr(3, 2); //len
	res += termToStrInternal(node_name, ""); //node
	res += intToStr(0, 1); //creation
	res += intToStr(0, 4);	//id BUG unable to handle really large ids
	res += intToStr(div(a.value, 0xFFFFFFFF), 4);	//id
	res += intToStr(a.value % 0xFFFFFFFF, 4);	//id
      }
    } else if (is_fun(a)) { //HACK
       debugln1("WARNING: encoding fun not implemented");
    } else if (is_binary(a)) { //HACK
       debugln1("WARNING: encoding binary not implemented");
    } else if (is_bitstring(a)) { //HACK
       debugln1("WARNING: encoding bitstring not implemented");
    } else if (is_float(a)) { //HACK
       debugln1("WARNING: encoding float not implemented");      
    } else if (is_binary_matchspec(a)) {
       debugln1("WARNING: encoding matchspec_binary not implemented");      
    } else throw "unknown type in term_to_binary";
    return res;
  }
  
  function intToStr(i, size) {
    var isNegative = i < 0, rem, res = "";
    if (isNegative) i = -i - 1;
    while (i > 0) {
      rem = i % 256;
      if (isNegative) rem = 255 - rem;
      res = String.fromCharCode(rem) + res;
      i = Math.floor(i / 256);
    }
    while (res.length < size) res = String.fromCharCode(0) + res;
    return res;
  }
}

var bootFile;

function loadFiles(files, mod, fun, args) {
  var Code1, Code2 = [];
  var localAtomToGlobal = [];
  var labelsToIp = [0];
  var Imports = [];
  var Funs = [];
  var Exports = {};
  var Literals = [];
  var Strings = '';
  var currentModuleName = '';
  var hasTypedArray = ('ArrayBuffer' in window && 'Uint8Array' in window);
  var loaded = 0;
  
  for (var i = 0; i < files.length; i++) fetch(files[i]);

  function fetch(file) {
    var arr, buffer, xhr = new XMLHttpRequest();
 
    xhr.open('GET', 'beams/'+file, true);
    if (hasTypedArray && 'mozResponseType' in xhr) {
      xhr.mozResponseType = 'arraybuffer';
    } else if (hasTypedArray && 'responseType' in xhr) {
      xhr.responseType = 'arraybuffer';
    } else {
      if (xhr.overrideMimeType)
	xhr.overrideMimeType('text/plain; charset=x-user-defined');
      hasTypedArray=false;
    }

    xhr.onreadystatechange = function() {
      var result;

      if (xhr.readyState != 4)  { return; }

      if (xhr.status != 200 && xhr.status != 0) {
	debugln1('Error while loading ');
      }

      if (!hasTypedArray) {
	if (xhr.responseBody != undefined) { 
	  result = vbarrayToArr(xhr.responseBody);
	} else result = xhr.responseText;
      } else {
	if ('mozResponse' in xhr) {
	  buffer = xhr.mozResponse;
	} else if (xhr.mozResponseArrayBuffer) {
	  buffer = xhr.mozResponseArrayBuffer;
	} else if ('responseType' in xhr) {
	  buffer = xhr.response;
	} 
	result = new Uint8Array(buffer, 0, buffer.byteLength);
      }

      if (file == 'start.boot') bootFile = result;  
      else if (file=='beamfiles.tar') untar(result);  
      else checkBeam(result, 0, result.length);
      
      if (++loaded == files.length) {
        for (var i in loaderAtomTable) AtomTable[loaderAtomTable[i]-(2<<27)] = i;
	erlangSpawn(-1, strToAtom(mod), strToAtom(fun), args, false);
	erl_exec();
      }
    }

    xhr.send(null);
  }
  

  function vbarrayToArr(a) {
    return vbarrayFirst(a).replace(/[\s\S]/g, function(str) {
			    var c = str.charCodeAt(0);
			    return String.fromCharCode(c&0xff, c>>8);
			  }) + vbarrayLast(a);
  }

  function untar(a) {
    var tarPos = 0, tarLen = a.length;
    while (tarPos <= tarLen) {
      labelsToIp = [0];
      Exports = {};
      localAtomToGlobal = [0];
      Literals = [];
      Code2 = [];
      Imports = [];
      Funs = [];
      var fileName = a.getZeroTerminatedString(tarPos, 100);
      if (fileName.length >= 100) throw 'No support for UStar extended filenames';
      if (fileName.length == 0) break;
      
      var i, lenStr = '0'; 
      for (i=0; i < 12; i++) 
	lenStr += String.fromCharCode(a.getByte(tarPos+124+i));
      var fileLen = parseInt(lenStr, 8);
      
//    var start = Date.now();
      if (fileName.match(/\.beam$/)) checkBeam(a, tarPos+512, fileLen);
//      if (fileName.match(/io_SUITE\.beam$/)) checkBeam(a, tarPos+512, fileLen);
      tarPos += 512 + 512 * Math.ceil(fileLen / 512);
//    var elapsed = Date.now()-start;
//    debugln1('loaded file'+fileName+': ');
    }
  }

  function checkBeam(a, p, len) {
    if (a.getString(p, 4) == 'FOR1' && a.getString(p+8, 4) == 'BEAM') {
      scanBeam(a, p+12, len-12); 
      transformBeam(); 
    } else { 
      throw 'Not a beam file';
    }
  }

  function scanBeam(a, pos, len) {
    var i;
    if (len > 8) { 
      var chunk = a.getString(pos, 4);
      var csize = a.getInt32(pos+4);
      var newpos = pos + (4 * Math.floor((csize+3) / 4)) + 8;
      len = len - (4 * Math.floor((csize+3) / 4) + 8);
      pos += 8;
//    var start = Date.now();
      switch (chunk) {
      case 'Atom': //Atoms 
	localAtomToGlobal = [0];
	var noOfAtoms = a.getInt32(pos);
	var atomPos = pos + 4;
	for (i = 0; i < noOfAtoms; i++) {
	  var alen = a.getByte(atomPos);
	  var atomStr = a.getString(atomPos+1, alen);
	  if (i == 0) { 
	    currentModuleName = atomStr;
//	    debugln1('loading '+currentModuleName);
	  }
	  atomPos += alen + 1;
	  
	  var globalAtom = loaderStrToAtom(atomStr) << 5 >> 5;
	  localAtomToGlobal[i+1] = globalAtom;
	}
	break;
      case 'LitT': //Literals
	var packed = a.subarray(pos+4, pos+csize);
	var deflated = new FlateStream(packed).getBytes();
	var numLit = deflated.getInt32(0);
	var litPos = 4;
	for (i = 0; i < numLit; i++) {
	  var len = deflated.getInt32(litPos);
	  var sa = deflated.subarray(litPos+4, litPos+4+len);
	  Literals[i]= arrayToTerm(sa, true);
	  litPos += len + 4;
	}
	break;
      case 'Code':
	var subSize = a.getInt32(pos);
	var instructionSetVersion = a.getInt32(pos+4);
	var operandMax = a.getInt32(pos+8);
	var noOfLabels = a.getInt32(pos+12);
	var noOfFunctions = a.getInt32(pos+16);
	decodeInstructions(a, pos+20, csize-20);
	break;
      case 'StrT': //Strings
        Strings = '';
	while(csize--) {
	  Strings = Strings+String.fromCharCode(a.getByte(pos++));
	}
	break;
      case 'FunT': //Lambdas
	var noOfEntries = a.getInt32(pos);
	for (i = 0; i < noOfEntries; i++) {
       	  var fun = a.getInt32(pos+i*24+4);
       	  var arity = a.getInt32(pos+i*24+8);
       	  var label = a.getInt32(pos+i*24+12);
       	  var index = a.getInt32(pos+i*24+16);
       	  var numFree = a.getInt32(pos+i*24+20);
       	  var oldUniq = a.getInt32(pos+i*24+24);
	  Funs[i] = [label, numFree, arity];
	}
	break;
      case 'ImpT': //Imports
	var noOfEntries = a.getInt32(pos);
	for (i = 0; i < noOfEntries; i++) {
	  var module = a.getInt32(pos+i*12+4);
	  var fun = a.getInt32(pos+i*12+8);
	  var arity = a.getInt32(pos+i*12+12);
	  Imports.push([module, fun, arity]); //localAtoms for mod and fun
	}
	break;
      case 'ExpT': //Exports
	var noOfEntries = a.getInt32(pos);
	for (i = 0; i < noOfEntries; i++) {
	  var fun = a.getInt32(pos+i*12+4);
	  var arity = a.getInt32(pos+i*12+8);
	  var label = a.getInt32(pos+i*12+12);
	  if (Exports[fun] == undefined) Exports[fun] = []; //localAtom for fun	  
	  Exports[fun][arity] = label;
	}
	break;
      case 'LocT': //Ignored by loader
	break;
      case 'Attr':
	//	debugln1(arrayToTerm(getString(a, pos, csize)));
	break;
      case 'CInf':
	//	debugln1(arrayToTerm(getString(a, pos, csize)));
	break;
      case 'Abst':
	break;
      default:
	throw 'Unknown chunk: '+chunk;
      }
//    var elapsed = Date.now()-start;
//    debugln1('chunk:'+ chunk +' '+elapsed);
      scanBeam(a, newpos, len);
    }
  }

  //Pass 1, parse the code segment
  function decodeInstructions(a, pos, size) {
    var origPos = pos;
    var codeEnd = pos + size;
    var ip = 0;
    var i, j;
    var op;
    try { Code1 = new Uint32Array(size) } catch (e) { Code1 = new Array(size); }

    while (pos < codeEnd) {
      op = a.getByte(pos++);
      if (op == 1) {
	var label = decodeArg();
	labelsToIp[label] = ip;
      } else if (op == 16) { //This is a NOP
	decodeArg();
	decodeArg();
      } else {
	Code1[ip++] = op;
	for (i = 0; i < ArityTable[op]; i++, ip++) {
	  Code1[ip] = decodeArg();
	}
      }
    }
    if (Code1 instanceof Array) Code1.length = ip;
    
    function decodeInt(b) {
      if ((b & 8) == 0) { 
	// less than 16 NNNN:0:TTT
	return b >> 4; 
      }
      else if ((b & 16) == 0) { 
	// less than 2048 NNN:01:TTT NNNNNNNN 
	var highest_bits = (b & (32+64+128)) << 3;
	var lowest_bits = a.getByte(pos++);
	return highest_bits + lowest_bits;
      } 
      else { 
	var len = b >> 5;
	if (len == 7) {
	  var i, val = [], l = decodeInt(a.getByte(pos++)) + 9;
	  for (i = pos; i<l+pos; i++) val.push(a.getByte(i));
	  pos += l;
	  Code2.push(new Math.BigInt(val));
	  return (Code2.length-1) | (6 << 27);
	} else { 
	  var value = 0, bigval = [];
	  var negative = a.getByte(pos)>127; 
	  len += 2;
	  for (var i = 0; i < len; i++) {
	    bigval.push(a.getByte(pos));
	    value = value * 256 + a.getByte(pos++);
	  }
	  if (negative) { 
	    value = value - Math.pow(256,len);
	    Code2.push(value);
	    return (Code2.length-1) | (6 << 27);	  
	  } 
	  if (is_small(value)) return value;
	  Code2.push(new Math.BigInt(bigval));
	  return (Code2.length-1) | (6 << 27);	  
	}
      }
    }
    
    function decodeArg() {
      var b = a.getByte(pos++), type = b & 7;
      if (type < 7) {
	if (type == 1) type = 0;
	var value = decodeInt(b);
	if (is_bignum(value)) return value; //Don't tag bignums
	return value | (type << 27);
      } else {
	switch(b >> 4) {
	case 0: //float
	  pos += 8;
	  Code2.push({type:am_float, value:arrayToFloat(a, pos-8)});
	  return (Code2.length-1) | (6 << 27);	  

	case 1: //select list
	  var list = [], len = decodeInt(a.getByte(pos++));
	  while(len-- > 0) list.push(decodeArg()); 
	  Code2.push(list);
	  return (Code2.length-1) | (6 << 27);	  

	case 2: //fr TODO: optimize
	  Code2.push({type: 'fr', value: decodeInt(a.getByte(pos++))});
	  return (Code2.length-1) | (6 << 27);	  

	case 3: //allocation list, (words, float, literals) //TODO does not seem to be needed
	  var len = decodeInt(a.getByte(pos++));
	  var list = [];
	  while(len-- > 0) {
	    list.push(decodeInt(a.getByte(pos++)));
	    list.push(decodeInt(a.getByte(pos++)));
	  }
	  Code2.push({type:'alist', list:list});
	  return (Code2.length-1) | (6 << 27);	
	  
	case 4: //literal
	  Code2.push({type:'literal', value:decodeInt(a.getByte(pos++))});
	  return (Code2.length-1) | (6 << 27);	  

	default: 
	  throw 'Unknown extended type '+(b >> 4);
	}
      }
    }
  }

  // Pass 2
  function transformBeam() {
    var op_ip, ip, j, k, op;

    // Export table must use ref to instructions (ip) instead of labels
    // Also, convert local atoms to global
    var fun, globalExports = [];
    for (fun in Exports) {
      for (j = 0; j < Exports[fun].length; j++) 
	Exports[fun][j] = labelsToIp[Exports[fun][j]];
      globalExports[localAtomToGlobal[fun]+(2<<27)] = Exports[fun]; 
    }
    
    // Convert labels in funs to ip
    for (j = 0; j < Funs.length; j++) {
      Funs[j][0] = labelsToIp[Funs[j][0]];
    }

    // Convert local atoms in import table
    for (j = 0; j < Imports.length; j++) {
      Imports[j][0] = localAtomToGlobal[Imports[j][0]]+(2<<27);
      Imports[j][1] = localAtomToGlobal[Imports[j][1]]+(2<<27);
    }

    for (ip = 0; ip < Code2.length;ip++) {
      var arg = Code2[ip];
      
      if (arg.type == 'literal') Code2[ip] = Literals[arg.value];

      if (arg instanceof Array) { //jump list in select_*
	  for (k = 0; k < arg.length; k++) {
	    if ((arg[k] >> 27) == 5) 
	      arg[k] = labelsToIp[(arg[k]<<5)>>5]; 
	    if ((arg[k] >> 27) == 2) 
	      arg[k] = (2<<27) + localAtomToGlobal[(arg[k]<<5)>>5];
	  }
      }      
    }
    
    for (ip = 0; ip < Code1.length;) {
      op_ip = ip;
      op = Code1[ip++];
      for (j = 0; j < ArityTable[op]; j++, ip++) {
	var arg = Code1[ip];
	switch(arg >> 27) {
	  case 2: // Atoms in code must be renumbered to global atom table
	    Code1[ip] = (2<<27)+localAtomToGlobal[(arg<<5)>>5];
	    break;
	  case 3: // change op code for the r register 
	    if (Code1[ip] == 3<<27) Code1[ip] = (Code1[ip]<<5>>5)+5<<27;
	    break;
	  case 5: // Jump labels must be replaced by ref to instruction
	    Code1[ip] = labelsToIp[arg << 5 >> 5];
	    break;
	}
      }
      
      //Special hack for apply and yield
      if (currentModuleName == 'erlang') {
	if (op == 8) { //ar=3 call_ext_last Ar Fun D -> apply_last Ar D
	  var mod = Imports[Code1[op_ip+2]][0];
	  var fun = Imports[Code1[op_ip+2]][1];
	  var ar  = Imports[Code1[op_ip+2]][2];
	  if (mod == am_erlang && fun == am_apply && (ar == 2 || ar == 3)) {
	    Code1[op_ip] = 113; //ar=2 apply_last
	    Code1[op_ip+1] = ar+100;
	    Code1[op_ip+3] = 19; //return
	  }
	}
	
	if (op == 78) { //ar=2 call_ext_only Ar Fun -> apply Ar
	  var mod = Imports[Code1[op_ip+2]][0];
	  var fun = Imports[Code1[op_ip+2]][1];
	  var ar  = Imports[Code1[op_ip+2]][2];
	  if (mod == am_erlang && fun == am_apply && (ar == 2 || ar == 3)) {
	    Code1[op_ip] = 112; //ar=1 apply
	    Code1[op_ip+1] = ar+100; //ar=2 apply_last
	    Code1[op_ip+2] = 19; //return
	  }
	  if (mod == am_erlang && fun == am_yield && ar == 0) {
	    Code1[op_ip] = 19; //return
	  }
	}
      }
      //TODO change
      if (op == 125) {
	var arity = 6;
	var operation = Code1[ip - arity + 2]; 
	var mod = Imports[operation][0];
	if (mod == am_erlang) {
	  var fun = Imports[operation][1];
	  Code1[ip - arity + 2] = fun;
	}
      }


      //Check for unsupported ops
      /*
      switch (op){
	case 54: //'is_constant/2'
	case 68: //'put_string/3'
	case 76: //'make_fun/3'
//	case 108: //'raise/2'
	case 149: //'on_load/0'
	case 152: //'gc_bif3/7'
	   //obsolete?
	case 27: //'m_plus/4'
	case 28: //'m_minus/4'
	case 29: //'m_times/4'
	case 30: //'m_div/4'
	case 31: //'int_div/4'
	case 32: //'int_rem/4'
	case 33: //'int_band/4'
	case 34: //'int_bor/4'
	case 35: //'int_bxor/4'
	case 36: //'int_bsl/4'
	case 37: //'int_bsr/4'
	case 38: //'int_bnot/3'
	  //old binary
	case 79: //'bs_start_match/2'
	case 80: //'bs_get_integer/5'
	case 81: //'bs_get_float/5'
	case 82: //'bs_get_binary/5'
	case 83: //'bs_skip_bits/4'
	case 84: //'bs_test_tail/2'
	case 85: //'bs_save/1'
	case 86: //'bs_restore/1'
	case 87: //'bs_init/2'
	case 88: //'bs_final/2'

	case 93: //'bs_need_buf/1'
          throw 'unsupported '+op;
      }
      */
    }
    
   Modules[loaderStrToAtom(currentModuleName)] = { name: currentModuleName, 
                                             type: 'module',
					     number: Modules.length, 
					     value: currentModuleName,
					     code: Code1,
					     literals: Code2,
					     exports: globalExports,
					     imports: Imports,
					     funs: Funs,
					     string: Strings,
					     atom: loaderStrToAtom(currentModuleName)};
  }
}

//
// END OF LOADER CODE
//




var node_monitor_processes = {};
var node_name = am_nonode_nohost;
var node_names = [];
var AtomTable = ['nil']; 

function indexOf(obj, arr) {
  for(var i=0; i<arr.length; i++) {
    if (arr[i] === obj) return i;
  }
  return arr.length;
}

//This function is expensive, do not use in time sensitive code!
function strToAtom(str){
  var res = indexOf(str, AtomTable);
  if (res == AtomTable.length) AtomTable[res] = str;
  return res+(2<<27);
}

function atomToStr(atom){
  return AtomTable[atom<<5>>5];
}


function div(a, b) { return (a - a % b) / b; }


function bif_bor2(c_p, s1, s2) {
  if (is_bignum(s1)) 
    if (is_bignum(s2)) return s1.or(s2);
    else return s1.or(Math.BigInt.valueOf(s2))
  if (is_bignum(s2)) return s2.or(Math.BigInt.valueOf(s1));
  if (is_smallnum(s1) && is_smallnum(s2))
    return s1 | s2;
  return badarith(c_p);
}

function bif_bxor2(c_p, s1, s2) {
  if (is_bignum(s1)) 
    if (is_bignum(s2)) return s1.xor(s2);
    else return s1.xor(Math.BigInt.valueOf(s2))
  if (is_bignum(s2)) return s2.xor(Math.BigInt.valueOf(s1));
  if (is_smallnum(s1) && is_smallnum(s2))
    return s1 ^ s2;
  return badarith(c_p);
}

function bif_band2(c_p, s1, s2) {
  if (is_bignum(s1)) 
    if (is_bignum(s2)) return s1.and(s2);
    else return s1.and(Math.BigInt.valueOf(s2))
  if (is_bignum(s2)) return s2.and(Math.BigInt.valueOf(s1));
  if (is_smallnum(s1) && is_smallnum(s2))
    return s1 & s2;
  return badarith(c_p);  
}

function bif_bsr2(c_p, s1, s2) {
  if (is_bignum(s1)) 
    if (is_bignum(s2)) return s1.shiftRight(s2);
    else return s1.shiftRight(Math.BigInt.valueOf(s2))
  if (is_bignum(s2)) return s2.shiftRight(Math.BigInt.valueOf(s1));
  if (is_smallnum(s1) && is_smallnum(s2))
    return s1 >> s2;
  return badarith(c_p);
}

function bif_bsl2(c_p, s1,s2) {
  if (is_bignum(s1)) 
    if (is_bignum(s2)) return s1.shiftLeft(s2);
    else return s1.shiftLeft(Math.BigInt.valueOf(s2))
  if (is_bignum(s2)) return Math.BigInt.valueOf(s1).shiftLeft(s2);
  if (is_smallnum(s1)) 
    if (s2 < 32 && s1 >>> (32-s2) == 0 ) return s1 << s2;
    else return Math.BigInt.valueOf(s1).shiftLeft(s2);
  return badarith(c_p);
}

function nullToBadarith(c_p, val) {
  return val == null ? badarith(c_p) : val; 
}

function bif_rem2(c_p, s1, s2) {
  if (is_float(s1)) s1=s1.value;
  if (is_float(s2)) s2=s2.value;
  if (is_bignum(s1)) 
    if (is_bignum(s2)) return nullToBadarith(c_p, s1.remainder(s2));
    else return nullToBadarith(c_p, s1.remainder(Math.BigInt.valueOf(s2)));
  if (is_bignum(s2)) return nullToBadarith(c_p, s2.remainder(Math.BigInt.valueOf(s1)));

  if (s2==0) return badarith(c_p, s2);
  s1 = s1 % s2;
  if (!(s1>0) && !(s1<=0)) return badarg_stacktrace(c_p, s1);
  if (is_small(s1)) return s1;
  return intToBig(s1);
}

function bif_div2(c_p, s1, s2) {
  if (is_float(s1)) s1=s1.value;
  if (is_float(s2)) s2=s2.value;
  if (is_bignum(s1)) 
    if (is_bignum(s2)) return nullToBadarith(c_p, s1.divide(s2));
    else return nullToBadarith(c_p, s1.divide(Math.BigInt.valueOf(s2)));
  if (is_bignum(s2)) return nullToBadarith(c_p, s2.divide(Math.BigInt.valueOf(s1)));

  if (s2==0) return badarith(c_p, s2);
  s1 = div(s1, s2);
  if (!(s1>0) && !(s1<=0)) return badarg_stacktrace(c_p, s1);
  if (is_small(s1)) return s1;
  return intToBig(s1);
}

function bif_divide2(c_p, s1, s2) {
  if (is_float(s1)) s1=s1.value;
  if (is_float(s2)) s2=s2.value;
  if (is_bignum(s1)) s1=s1.doubleValue();
  if (is_bignum(s2)) s2=s2.doubleValue();
  if (s2==0) return badarith(c_p, s2);
  if (!(s1>0) && !(s1<=0)) return badarg_stacktrace(c_p, s1);
  s1 = s1/s2;
  return {type:am_float, value: s1};
}

function bif_multiply2(c_p, s1, s2) {
  if (is_float(s1)) s1=s1.value;
  if (is_float(s2)) s2=s2.value;
  if (is_bignum(s1)) 
    if (is_bignum(s2)) return s1.multiply(s2);
    else return s1.multiply(Math.BigInt.valueOf(s2))
  if (is_bignum(s2)) return s2.multiply(Math.BigInt.valueOf(s1));

  s1 = s1*s2;
  if (!(s1>0) && !(s1<=0)) return badarg_stacktrace(c_p, s1);
  if (Math.round(s1) != s1) return {type:am_float, value: s1};
  if (is_small(s1)) return s1;
  return intToBig(s1);
}

function bif_plus2(c_p, s1, s2) {
  if (typeof s1 == typeof s2 && typeof s1 == 'number') {
    s1 = s1+s2;
    if (is_small(s1)) return s1;
    return new Math.BigInt.valueOf(s1);
  }
  if (is_float(s1)) s1=s1.value;
  if (is_float(s2)) s2=s2.value;
  if (is_bignum(s1)) 
    if (is_bignum(s2)) return s1.add(s2);
    else return s1.add(Math.BigInt.valueOf(s2))
  if (is_bignum(s2)) return s2.add(Math.BigInt.valueOf(s1));

  if (typeof s1 != 'number') return badarg(c_p, s1);
  if (typeof s2 != 'number') return badarg(c_p, s2);
  s1 = s1+s2;
  if (is_small(s1)) return s1;
  return new Math.BigInt.valueOf(s1);
}

function bif_minus2(c_p, s1, s2) {
  if (typeof s1 == typeof s2 && typeof s1 == 'number') {
    s1 = s1-s2;
    if (is_small(s1)) return s1;
    return new Math.BigInt.valueOf(s1);
  }
  if (is_float(s1)) s1=s1.value;
  if (is_float(s2)) s2=s2.value;
  if (is_bignum(s1)) 
    if (is_bignum(s2)) return s1.subtract(s2);
    else return s1.subtract(Math.BigInt.valueOf(s2))
  if (is_bignum(s2)) return s2.subtract(Math.BigInt.valueOf(s1));
  if (typeof s1 != 'number') return badarg(c_p, s1);
  if (typeof s2 != 'number') return badarg(c_p, s2);
  s1 = s1-s2;
  if (is_small(s1)) return s1;
  return new Math.BigInt.valueOf(s1);
}


function intToBig(i) {
  return Math.BigInt.valueOf(i);
}

//returns double *approximation* of bignum, use with caution
function bigToInt(big) {
  return big.doubleValue();
}

function ge(s1, s2) {
  return !lt(s1, s2);
}

function lt(s1, s2) {
//  debugln1('lt:'+pp(s1)+'<'+pp(s2))
  var t1 = typeof s1, t2 = typeof s2;
  if (t1 == t2) { //integer, str or object
    switch (t1) {
      case 'number': //atom or small integer
        if (is_atom(s1) && is_atom(s2)) {
	  return atomToStr(s1) < atomToStr(s2);
	} 
	else if (is_atom(s1)) return false;
	else if (is_atom(s2)) return true;
	return s1 < s2;
      case 'string': //binary
        return s1 < s2;
      default: //reference, fun, port, pid, tuple, list, bignums and floats
        if (is_tuple(s1) && is_tuple(s2)) {
	  if (s1.length < s2.length) return true;
	  if (s1.length > s2.length) return false;
	  var i;
	  for (i = 0; i < s1.length; i++) {
	    if (!eq(s1[i], s2[i])) break;
	  }
	  if (i < s1.length && lt(s1[i], s2[i])) return true;
	  return false;
	}
	if (is_list(s1) && is_list(s2)) return !listGe(s1,s2);
	if (is_bignum(s1) && is_bignum(s2)) return s1.compareTo(s2) == -1 ? true : false;
	if (s1.type == s2.type && s1.type != undefined) {
	  if (is_float(s1)) return s1.value < s2.value;
	  return false; //reference, fun, port, pid
	}
    }
  }
  //Different javascript types
  if (is_integer(s1) && is_integer(s2)) { 
    //only one can be a bignum, but bignums can still be negative
    if (is_bignum(s1)) return s1.doubleValue() < s2; 
    if (is_bignum(s2)) return s1 < s2.doubleValue();
  }
  if (is_number(s1) && is_number(s2)) { //TODO handle bignums vs floats
    //only one can be a float
    if (s1.type == am_float) s1 = s1.value; 
    else if (s2.type == am_float) s2 = s2.value; 
    else throw 'inconsistency in lt()';
    return s1 < s2;
  }
  //only one can be a float //TODO handle bignums
//  if (s1.type == am_float && is_integer(s2)) return s1.value < s2; 
//  else if (s2.type == am_float && is_integer(s1)) return s1 < s2.value; 
  if (is_list(s1) && is_list(s2)) { return !listGe(s1,s2); }

  //number < atom < reference < fun < port < pid < tuple < list < bitstring
  if (is_number(s1)) s1 = 1;
  else if (is_atom(s1)) s1 = 2;
  else if (is_reference(s1)) s1 = 3;
  else if (is_fun(s1)) s1 = 4;
  else if (is_pid(s1)) s1 = 5;
  else if (is_tuple(s1)) s1 = 6;
  else if (is_list(s1)) s1 = 7;
  else if (is_binary(s1)) s1 = 8;
  
  if (is_number(s2)) s2 = 1;
  else if (is_atom(s2)) s2 = 2;
  else if (is_reference(s2)) s2 = 3;
  else if (is_fun(s2)) s2 = 4;
  else if (is_pid(s2)) s2 = 5;
  else if (is_tuple(s2)) s2 = 6;
  else if (is_list(s2)) s2 = 7;
  else if (is_binary(s2)) s2 = 8;
  return s1 < s2
}
function listGe(list1, list2){ //TODO handle improper lists
  while (list1 != 2<<27 && list2 != 2<<27) {
    if (!eq(list1.value, list2.value)) break;
    list1=list1.next;
    list2=list2.next;
  }
  if (list1==2<<27 && list2!=2<<27) return false; 
  if (list2==2<<27) return true; 
  if (!ge(list1.value, list2.value)) return false;
  return true;
}

function eq_exact(s1, s2) {
  if (s1 === s2) return true;
  if (is_bignum(s1))
    if (is_bignum(s2)) return s1.equals(s2);
    else if (is_integer(s2))
      return s1.equals(Math.BigInt.valueOf(s2));
  if (is_bignum(s2)) 
    return s2.equals(Math.BigInt.valueOf(s1));

  if (typeof s1 != typeof s2) return false;
  switch (typeof s1) {
    case 'number': if (s1 != s2) return false; else return true;
    case 'string': if (s1 != s2) return false; else return true;

    default:
      
      if (s1 instanceof Array) {
	if (s2 instanceof Array) {
	  if (s1.length != s2.length) return false;
	  for (var i = 0; i < s1.length; i++) {
	    if (!eq_exact(s1[i], s2[i])) return false;
	  }
	  return true;
	} else return false;
      }
      if (s1.next != undefined) return listCompareExact(s1, s2);
      if (s1.type == s2.type && eq(s1.value, s2.value) && s1.type != undefined) 
	return true; 
  }
  return false;
}

function eq(s1, s2) {
  if (s1 === s2) return true;
  if (typeof s1 != typeof s2) {
    if (s1.type == am_float && s1.value===s2) return true; 
    if (s2.type == am_float && s2.value===s1) return true;
    if (is_bignum(s1) && s1.doubleValue() == s2) return true; 
    if (is_bignum(s2) && s2.doubleValue() == s1) return true;
    if (s1.type == am_float && is_bignum(s2) && s1.value===s2.doubleValue()) return true; 
    if (s2.type == am_float && is_bignum(s1) && s2.value===s1.doubleValue()) return true;
    return false;
  }
  switch (typeof s1) {
    case 'number': 
    case 'string': 
      if (s1 != s2) return false; else throw 'inconsistency in eq()';

    default:
      if (is_bignum(s1))
	if (is_bignum(s2)) return s1.equals(s2);
	else return s1.equals(Math.BigInt.valueOf(s2));
      if (is_bignum(s2)) return s2.equals(Math.BigInt.valueOf(s1));
	  
      if (s1 instanceof Array) {
	if (s2 instanceof Array) {
	  if (s1.length != s2.length) return false;
	  for (var i = 0; i < s1.length; i++) {
	    if (!eq(s1[i], s2[i])) return false;
	  }
	  return true;
	} else return false;
      }
      if (s1.next != undefined) return listCompare(s1, s2);
      if (s1.type == s2.type && s1.value == s2.value) return true; //TODO eq(s1.value, s2.value) for e.g. external pids?
  }
  return false;
}

function listCompare(list1, list2){ 
  while (list1 != 2<<27 && list2 != 2<<27) {
    if (!eq(list1.value, list2.value)) return false; 
    list1=list1.next;
    list2=list2.next;
    if (list1.next == undefined || list2.next == undefined) {
      if (eq(list1, list2)) return true;
      return false;
    }
  }
  if (list1==list2) { return true;} 
  return false;
}

function listCompareExact(list1, list2){ 
  while (list1 != 2<<27 && list2 != 2<<27) {
    if (!eq_exact(list1.value, list2.value)) return false; 
    list1=list1.next;
    list2=list2.next;
    if (list1.next == undefined || list2.next == undefined) {
      if (eq_exact(list1, list2)) return true;
      return false;
    }
  }
  if (list1==list2) { return true;} 
  return false;
}

//proper list: {value:'foo', next:{value:{type:am_pid, value:xx} next: 2<<27}}
// [foo, pid#<xx>]
//improper list: {value:'foo', next:{value:'bar', next: {type:am_pid, value:xx}}}
// [foo, bar | pid#<xx>]

//Type checks
function isNaN(s1) {
  if (is_bignum(s1)) return false;
  if (s1.type==am_float) return false;
  if (!(s1>0) && !(s1<=0)) return true;
}

//is_big/is_small should only be applied on values known to be integers
function is_big(n) {
  return !is_small(n);
}
function is_small(n) {
  return (n<(1<<26)-1 && n > -(1<<26));
}

function is_bignum(n) {
  return (n instanceof Math.BigInt);
}
function is_smallnum(arg1) {
  return (typeof arg1 === 'number' && ((arg1 >> 27) < 2));
}
function is_number(arg1) { 
  return ((typeof arg1 == 'number' && ((arg1 >> 27) < 2)) || 
           is_bignum(arg1) || arg1.type==am_float);
}
function is_integer(arg1) {
  return ((typeof arg1 == 'number' && ((arg1 >> 27) < 2)) || 
           is_bignum(arg1) );
}
function is_pid(arg1) {
  return (arg1.type==am_pid);
}
function is_external_pid(pid) {
  if (is_pid(pid) && pid.value instanceof Array && pid.value.length == 4) return true;
  return false;
}
function is_reference(arg1) {
  return (arg1.type=='ref');
}
function is_external_reference(arg1) {
  return (arg1.type=='ref' && arg1.value instanceof Array && arg1.value.length == 4) ? true : false;
}
function is_fun(arg1) {
  return (arg1.type=='fun');
}
function is_float(arg1) {
  return (arg1.type==am_float);
}
function is_binary(arg1) {
  return (typeof arg1 == 'string');
}
function is_bitstring(arg1) {
  return (is_binary(arg1) || arg1.type == 'bitstring');
}
function is_binary_matchspec(arg1) {
  return (arg1.type == 'matchspec_binary');
}
function is_bitstring_matchspec(arg1) {
  return (arg1.type == 'matchspec_bitstring');
}
function is_atom(arg1) {
  return ((arg1>>27) == 2 && arg1 != 2<<27 && !is_tuple(arg1));
}
function is_list(arg1) {
  return (arg1.next != undefined || arg1 == (2 << 27));
}
function is_iolist(arg1) {
  return (is_list(arg1) || is_binary(arg1));
}
function is_nonempty_list(arg1) {
  return (arg1.next != undefined);
}
function is_boolean(arg1) {
  return (arg1==am_true || arg1 == am_false);
}
function is_port(arg1) {
  return (arg1.type == 'port' );
}
function is_tuple(arg1) {
  return (arg1 instanceof Array );
}


//Bif0 - Cannot fail
function bif0(c_p, mfa) {
  if (mfa[0] != am_erlang || mfa[2] != 0) throw 'Unknown bif0';
  switch(mfa[1]){
    case am_self: 
     return {type: am_pid, value: c_p.name};
    case am_node:
      return node_name;
    default: 
      throw 'unknown bif0: '+pp(fun);
  }
}


//gc_bif1 - Can fail
function gc_bif1(c_p, mfa, arg1) {
  if (mfa[0] != am_erlang || mfa[2] != 1) throw 'Unknown gc_bif1';
  switch(mfa[1]){
    case am_round: 
      if (is_integer(arg1)) return arg1; 
      if (is_float(arg1)) return Math.round(arg1.value); 
      badarg(c_p, arg1);
    case am_float: 
      if (is_float(arg1)) return arg1; 
      if (is_bignum(arg1)) return {type:am_float, value:arg1.doubleValue()}; 
      if (is_integer(arg1)) return {type:am_float, value:arg1}; 
      return badarg(c_p, arg1);
    case am_size: //TODO difference size & byte_size
      return (is_binary(arg1) || is_tuple(arg1)) ? arg1.length : badarg(c_p, arg1);
    case am_byte_size:
      return is_binary(arg1) ? arg1.length : badarg(c_p, arg1);
    case am_bit_size:
      return is_binary(arg1) ? arg1.length*8 : badarg(c_p, arg1);
    case am_length:
      if(!is_list(arg1)) return badarg(c_p, arg1);
      var l = listLen(arg1);
      return l == undefined ? badarg(c_p, arg1) : l;

    case am_sign_minus: 
      if (!is_number(arg1)) return badarg(c_p, arg1);
      if (is_bignum(arg1)) return arg1.negate();
      if (is_float(arg1)) return {type:am_float, value:-arg1.value};
      return -arg1;
    case am_sign_plus: 
      if (!is_number(arg1)) return badarg(c_p, arg1);
      return arg1;
    case am_abs:
      if (!is_number(arg1)) return badarg(c_p, arg1);
      if (is_bignum(arg1)) return arg1.abs();
      if (is_float(arg1)) return {type:am_float, value:Math.abs(arg1.value)};
      return Math.abs(arg1);
    case am_trunc:
      if (is_integer(arg1)) return arg1;
      if (!(arg1.value>0) && !(arg1.value<=0)) throw 'NaN'
      if (is_float(arg1)) return Math.floor(arg1.value);
      throw badarg(c_p, arg1);
    default: 
      throw 'unknown gc_bif1: '+pp(fun);
  }
}


//bif1 - Can fail
function bif1(c_p, mfa, arg1) {
  if (mfa[0] != am_erlang || mfa[2] != 1) throw 'Unknown bif1';
  switch(mfa[1]){
    case am_is_port: 
      return is_port(arg1) ? am_true : am_false;
    case am_is_number: 
      return is_number(arg1) ? am_true : am_false;
    case am_is_integer: 
      return is_integer(arg1) ? am_true : am_false;
    case am_is_list: 
      return is_list(arg1) ? am_true : am_false;
    case am_is_tuple: 
      return is_tuple(arg1) ? am_true : am_false;
    case am_is_atom: 
      return is_atom(arg1) ? am_true : am_false;
    case am_is_pid: 
      return is_pid(arg1) ? am_true : am_false;
    case am_is_binary: 
      return is_binary(arg1) ? am_true : am_false;
    case am_is_boolean:
      return is_boolean(arg1) ? am_true : am_false;

    case am_node:
      if(!is_pid(arg1)) return badarg(c_p, arg1);
      if(arg1.value[0] != undefined) return arg1.value[0];
      return node_name;

    case am_tuple_size:
      return is_tuple(arg1) ? arg1.length : badarg(c_p, arg1);

    case am_not:
      if (arg1 == am_true) return am_false;
      if (arg1 == am_false) return am_true;
      return badarg(c_p, arg1);

    case am_hd:
      return is_nonempty_list(arg1) ? arg1.value : badarg(c_p, arg1); 
    case am_tl:
      return is_nonempty_list(arg1) ? arg1.next : badarg(c_p, arg1); 

    case am_get:
      var e = c_p.registry[arg1];
      return (e == undefined) ? strToAtom('undefined') : e[1];  

    default:
      throw 'unknown bif1: '+pp(mfa)
  }
}

function gc_bif2(c_p, fun, arg1, arg2) {
  switch(fun) {
    case am_sign_minus:     return bif_minus2(c_p, arg1, arg2);
    case am_sign_plus:      return bif_plus2(c_p, arg1, arg2)
    case am_sign_multiply:  return bif_multiply2(c_p, arg1, arg2);
    case am_sign_divide:    return bif_divide2(c_p, arg1, arg2);
    case am_rem:            return bif_rem2(c_p, arg1, arg2);
    case am_div:            return bif_div2(c_p, arg1, arg2);
    case am_band:           return bif_band2(c_p, arg1, arg2);
    case am_bsr:            return bif_bsr2(c_p, arg1, arg2);
    case am_bsl:            return bif_bsl2(c_p, arg1, arg2);
    case am_bor:            return bif_bor2(c_p, arg1, arg2);
    case am_bxor:           return bif_bxor2(c_p, arg1, arg2);
  }
}

//bif2 - Can fail
function bif2(c_p, mfa, arg1, arg2) {
  if (mfa[0] != am_erlang || mfa[2] != 2) throw 'Unknown bif2';
  switch(mfa[1]){
    case am_element: 
      if (!is_integer(arg1)) return badarg(c_p, arg1);
      if (!is_tuple(arg2)) return badarg(c_p, arg2);
      if (arg1 > arg2.length) return badarg(c_p, arg1);
      return arg2[(arg1<<5>>5)-1];
    case am_sign_equal_exact:
      if (eq_exact(arg1, arg2)) return am_true; 
      else return am_false;
    case am_sign_not_equal_exact:
      if (!eq_exact(arg1, arg2)) return am_true; 
      else return am_false;
    case am_sign_equal:
      if (eq(arg1, arg2)) return am_true; 
      else return am_false;
    case am_sign_gt: //TODO optimize?
      return (ge(arg1, arg2) && ! eq(arg1, arg2)) ? am_true : am_false;
    case am_sign_lt:
      return lt(arg1,arg2) ? am_true : am_false;
    case am_sign_gte:
      return ge(arg1, arg2) ? am_true : am_false;
    case am_sign_lte:
      return lt(arg1, arg2) || eq(arg1, arg2) ? am_true : am_false;
    case am_and:
      if (!is_boolean(arg1)) return badarg(c_p, arg1);
      if (!is_boolean(arg2)) return badarg(c_p, arg2);
      return (arg1 == arg2 && arg1 == am_true ) ?
	am_true : am_false;
    case am_or:
      if (!is_boolean(arg1)) return badarg(c_p, arg1);
      if (!is_boolean(arg2)) return badarg(c_p, arg2);
      return (arg1 == am_true || arg2 == am_true ) ?
	am_true : am_false;

    default: throw c_p.mod.name+': unknown bif2: '+pp(fun);
  }
}

function badarg_stacktrace(c_p, arg1) {
  c_p.fault = true;
  c_p.fault_class = strToAtom('error'); 
  c_p.stacktrace = stacktrace(c_p);
  return am_badarg;
}

function badarity_stacktrace(c_p, fun, arg1) {
  c_p.fault = true;
  c_p.fault_class = strToAtom('error'); 
  c_p.stacktrace = stacktrace(c_p);
  return [am_badarity, [fun, arg1]];
}

function badarg(c_p, arg1) {
  c_p.fault = true;
  return am_badarg;
}

function badarith(c_p, arg1) {
  c_p.fault = true;
  return [strToAtom('badarith'), stacktrace(c_p)]; //BUG, lacks current function
}

var file_seek = 0; //HACK
var cdir = [47,116,109,112];
var nowUnique = 1;




function bif(c_p, m, f, a, x) {
  switch (m.atom) {
    case am_erlang:
      switch(f) {
	
	//Time handling
	
	case am_now:
	  if (a!=0) break;
	  var ms = Date.now(), s = div(ms, 1000), Ms = div(s,1000000);
	  nowUnique = nowUnique%998;
	  return [Ms, s%1000000, (ms%1000)*1000+nowUnique++];

	case am_date:
	  if (a!=0) break;
	  var D = new Date();
	  return [D.getFullYear(), D.getMonth()+1, D.getDate()];
	        
	case am_localtime:
	  if (a!=0) break;
	  var D = new Date();
	  return [[D.getFullYear(), D.getMonth()+1, D.getDate()],
	  [D.getHours(), D.getMinutes(), D.getSeconds()]];

	case am_universaltime_to_localtime:
	  var D = new Date();
	  if (a==1) {
	    D.setUTCFullYear(x[0][0][0]);
	    D.setUTCMonth(x[0][0][1]-1);
	    D.setUTCDate(x[0][0][2]);
	    D.setUTCHours(x[0][1][0]);
	    D.setUTCMinutes(x[0][1][1]);
	    D.setUTCSeconds(x[0][1][2]);
	  } else break;
	  return [[D.getFullYear(), D.getMonth()+1, D.getDate()],
	  [D.getHours(), D.getMinutes(), D.getSeconds()]];

	case am_time:
	  if (a!=0) break;
	  var D = new Date();
	  return [D.getHours(), D.getMinutes(), D.getSeconds()];

	case am_universaltime_to_localtime:  
	  if (a!=1) break;
	  //TODO check args and do conversion
	  return x[0];

	  
	  //System info
	  
	case am_statistics:
	  if (a!=1) break;
	  if (! is_atom(x[0])) return badarg_stacktrace(c_p, x[0]);
	  if (x[0] == strToAtom('garbage_collection')) return [0,0,0];
	  if (x[0] == strToAtom('reductions')) return [0,0];
	  if (x[0] == strToAtom('runtime')) return [0,0];
	  return badarg_stacktrace(c_p, x[0]);

	case am_system_info:
	  if (a!=1) break;
	  if (x[0] == strToAtom('os_type')) 
	    return [strToAtom('unix'),strToAtom('linux')];
	  if (x[0] == strToAtom('hipe_architecture')) 
	    return strToAtom('none'); 
	  if (x[0] == strToAtom('thread_pool_size')) 
	    return 0; 
	  if (x[0] == strToAtom('system_version')) 
	    return strToList('Erlang R14B04');
	  if (x[0] == strToAtom('modified_timing_level')) 
	    return am_false;
	  if (x[0] == strToAtom('version')) 
	    return strToList('5.8.5');
	  if (x[0] == strToAtom('process_count')) 
	    return 25; //HACK should return real number of live processes
	    if ((x[0] instanceof Array) && (x[0][0] == strToAtom('purify')))
	      return am_true;
	    else {
	      debugln1('WARNING Unknown system_info:'+pp(x[0]));
	      return badarg_stacktrace(c_p, x[0]);
	    }

	  
	  //Math
	  
	case am_float: 
	  if (a!=1) break;
	  if (is_float(x[0])) return x[0]; 
	  if (is_bignum(x[0])) return {type:am_float, value:x[0].doubleValue()}; 
	  if (is_integer(x[0])) return {type:am_float, value:x[0]}; 
	  return badarg_stacktrace(c_p, x[0]);

	case am_sign_minus: 
	  if (a==1) {
	    if(!is_number(x[0])) return badarg_stacktrace(c_p, x[0]);
	    if (is_float(x[0]))  return {type:x[0].type, value:-x[0].value};
	    if (is_bignum(x[0])) return x[0].negate();
	    return -x[0];
	  }
	  else if (a==2) {
	    if(!is_number(x[0])) return badarg_stacktrace(c_p, x[0]);
	    if(!is_number(x[1])) return badarg_stacktrace(c_p, x[1]);
	    return bif_minus2(c_p, x[0], x[1]);
	  } else break;
	  
	case am_sign_equal:
	  if (a!=2) break;
	  return eq(x[0], x[1]) ? am_true: am_false;
	  
	case am_sign_not_equal:
	  if (a!=2) break;
	  return !eq(x[0], x[1]) ? am_true: am_false;

	case am_sign_equal_exact:
	  if (a!=2) break;
	  return eq_exact(x[0], x[1]) ? am_true: am_false;

	case am_sign_not_equal_exact:
	  if (a!=2) break;
	  return !eq_exact(x[0], x[1]) ? am_true: am_false;

	case am_sign_lt:
	  if (a!=2) break;
	  return lt(x[0], x[1]) ? am_true:am_false;
      
	case am_sign_gt:
	  if (a!=2) break;
	  return ge(x[0], x[1]) && !eq(x[0], x[1]) ? am_true:am_false;

	case am_sign_gte:
	  if (a!=2) break;
	  return ge(x[0], x[1]) ? am_true:am_false;

	case am_sign_lte:
	  if (a!=2) break;
	  return lt(x[0], x[1]) || eq(x[0], x[1]) ? am_true:am_false;

	case am_sign_plus:
	  if (a!=2) break;
	  if(!is_number(x[0])) return badarg_stacktrace(c_p, x[0]);
	  if(!is_number(x[1])) return badarg_stacktrace(c_p, x[1]);
	  return bif_plus2(c_p, x[0], x[1]);


	case am_sign_multiply:
	  if (a!=2) break;
	  if(!is_number(x[0])) return badarg_stacktrace(c_p, x[0]);
	  if(!is_number(x[1])) return badarg_stacktrace(c_p, x[1]);
	  return bif_multiply2(c_p, x[0], x[1]);

	case am_sign_divide:
	  if (a!=2) break;
	  if(!is_number(x[0])) return badarg_stacktrace(c_p, x[0]);
	  if(!is_number(x[1])) return badarg_stacktrace(c_p, x[1]);
	  return bif_divide2(c_p, x[0], x[1]);

	case am_div:
	  if (a!=2) break;
	  if(!is_number(x[0])) return badarg_stacktrace(c_p, x[0]);
	  if(!is_number(x[1])) return badarg_stacktrace(c_p, x[1]);
	  return bif_div2(c_p, x[0], x[1]);

	case am_rem:
	  if (a!=2) break;
	  if(!is_number(x[0])) return badarg_stacktrace(c_p, x[0]);
	  if(!is_number(x[1])) return badarg_stacktrace(c_p, x[1]);
	  return bif_rem2(c_p, x[0], x[1]);

	case am_band:
	  if (a!=2) break;
	  if(!is_number(x[0])) return badarg_stacktrace(c_p, x[0]);
	  if(!is_number(x[1])) return badarg_stacktrace(c_p, x[1]);
	  return bif_band2(c_p, x[0], x[1]);

	case am_bxor:
	  if (a!=2) break;
	  if(!is_number(x[0])) return badarg_stacktrace(c_p, x[0]);
	  if(!is_number(x[1])) return badarg_stacktrace(c_p, x[1]);
	  return bif_bxor2(c_p, x[0], x[1]);

	case am_bor:
	  if (a!=2) break;
	  if(!is_number(x[0])) return badarg_stacktrace(c_p, x[0]);
	  if(!is_number(x[1])) return badarg_stacktrace(c_p, x[1]);
	  return bif_bor2(c_p, x[0], x[1]);

	case am_bsr:
	  if (a!=2) break;
	  if(!is_number(x[0])) return badarg_stacktrace(c_p, x[0]);
	  if(!is_number(x[1])) return badarg_stacktrace(c_p, x[1]);
	  return bif_bsr2(c_p, x[0], x[1]);

	case am_bsl:
	  if (a!=2) break;
	  if(!is_number(x[0])) return badarg_stacktrace(c_p, x[0]);
	  if(!is_number(x[1])) return badarg_stacktrace(c_p, x[1]);
	  return bif_bsl2(c_p, x[0], x[1]);

	  
	  //Process handling
	  
	case am_group_leader: 
	  if (a==0) {
	    var pid = (c_p.group_leader == undefined) ? 0 : c_p.group_leader; 
	    return {type:am_pid, value:pid};
	  } else if (a==2) {
	    if (!is_pid(x[0])) return badarg_stacktrace(c_p, x[0]);
	    if (!is_pid(x[1])) return badarg_stacktrace(c_p, x[1]);
	    procs[x[1].value].group_leader = x[0].value;
	    return am_true;
	  } else break;
	  
	case am_registered:
	  if (a!=0) break;
	  var res = [];
	  for (var i in reg_procs) res.push(Number(i));
	  return arrayToList(res);

	case am_processes:
	  if (a!=0) break;
	  var res = [];
	  for (var j=0; j< procs.length; j++) 
	    if (procs[j] != undefined) res.push({type:am_pid, value:j});
	    return arrayToList(res);

	case am_register:
	  if (a!=2) break;
	  if (!is_pid(x[1])) return badarg_stacktrace(c_p, x[1]);
	  if (!is_atom(x[0])) return badarg_stacktrace(c_p, x[0]);
	  reg_procs[x[0]]=x[1];
	  procs[x[1].value].regname = x[0];
	  return am_true;

	case am_unregister: 
	  if (a!=1) break;
	  if (!is_atom(x[0])) return badarg_stacktrace(c_p, x[0]);
	  delete c_p.regname;
	  delete reg_procs[x[0]];
	  return am_true;
      
	case am_whereis:
	  if (a!=1) break;
	  if (!is_atom(x[0])) return badarg_stacktrace(c_p, x[0]);
	  var res = reg_procs[x[0]];
	  if (res == undefined || procs[res.value] == undefined) return strToAtom('undefined');
	  return res; //TODO regprocs should be cleaned up at process exit

	case am_self:
	  if (a!=0) break;
	  return {type:am_pid, value:c_p.name};

	case am_process_info:
	  if (a==1) {
	    if (!is_pid(x[0])) return badarg_stacktrace(c_p, x[0]);
	    var p = x[0].value;
	    var pa = procs[p];
	    var a = [];
	    var cmod = is_atom(pa.mod) ? atomToModule(pa.mod): pa.mod;
	    var cfun = ipToFunction(cmod, pa.ip);
	    a[0] = [strToAtom('current_function'), [strToAtom(cmod.name),strToAtom(cfun[0]),cfun[1]]];
	    a[1] = [strToAtom('status'), strToAtom(c_p.state)]; //TODO state!=status
	    a[2] = [strToAtom('message_queue_len'), pa.msgs.length];
	    a[3] = [strToAtom('messages'), arrayToList(pa.msgs)];
	    a[4] = [strToAtom('links'), 2<<27];
	    a[5] = [strToAtom('dictionary'), 2<<27];
	    a[6] = [strToAtom('trap_exit'), am_true];
	    a[7] = [strToAtom('error_handler'), strToAtom('error_handler')];
	    a[8] = [strToAtom('priority'), strToAtom('normal')];
	    a[9] = [strToAtom('group_leader'), mkPid(pa.group_leader)];
	    a[10] = [strToAtom('total_heap_size'), 0];
	    a[11] = [strToAtom('heap_size'), 0];
	    a[12] = [strToAtom('stack_size'), 0];
	    a[13] = [strToAtom('reductions'), 0];
	    a[14] = [strToAtom('garbage_collection'), 2<<27];
	    a[15] = [strToAtom('suspending'), 2<<27];
	    a[16] = [strToAtom('initial_call'), [pa.initial_mod,pa.initial_fun, pa.initial_ar<<5>>5]];
	    var res = procs[p].regname;
	    if (res != undefined)  a.push([strToAtom('registered_name'), res]);
	    return arrayToList(a);
	  } else if (a==2) {
	    if (!is_pid(x[0])) return badarg_stacktrace(c_p, x[0]);
	    if (!is_atom(x[1])) return badarg_stacktrace(c_p, x[1]);
	    var p = x[0].value;
	    var pa = procs[p];
	    if (x[1]==strToAtom('registered_name')) {
	      if (c_p.regname == undefined) return 2 << 27;
	      else return [strToAtom('registered_name'), pa.regname];
	    } else if (x[1]==strToAtom('links')) { //TODO
	        return [x[1], 2<<27];
	    } else if (x[1]==strToAtom('dictionary')) { //TODO
	        return [x[1], 2<<27];
	    } else if (x[1]==strToAtom('messages')) { //TODO
	        return [x[1], arrayToList(pa.msgs)];
	    } else if (x[1]==strToAtom('heap_size')) { 
	        return [x[1], 0];
	    } else if (x[1]==strToAtom('stack_size')) { 
	        return [x[1], 0];
	    } else if (x[1]==strToAtom('reductions')) { 
	        return [x[1], 0];
	    } else if (x[1]==strToAtom('group_leader')) { 
	        return [x[1], mkPid(c_p.group_leader)];
	    } else if (x[1]==strToAtom('message_queue_len')) { 
       	        var pa = procs[x[0].value]; 
	        return [x[1], pa.msgs.length];
	    } else if (x[1]==strToAtom('trap_exit')) { //TODO
	        return [x[1], am_true];
	    } else if (x[1]==strToAtom('initial_call')) {
	      var pa = procs[x[0].value]; 
	      return [strToAtom('initial_call'), 
	      [ pa.initial_mod+(2<<27),pa.initial_fun+(2<<27), pa.initial_ar<<5>>5]];
	    } else if (x[1]==strToAtom('status')) { //TODO
	      return [x[1], strToAtom('running')];
	    } else throw 'unknown process_info: '+pp(x[1]);
	  } else break;
	  
	case am_process_display: //TODO
	  if (a!=2) break;
          return 2<<27;
          
	case am_process_flag:
	  if (a!=2) break;
	  if (x[0] == strToAtom('trap_exit')) { 
	    if (x[1]!=am_true && x[1]!=am_false) 
	      return badarg_stacktrace(c_p, x[1]);
	    var oldVal = c_p.trap_exit;
	    c_p.trap_exit = x[1];
	    return oldVal == undefined ? am_false: oldVal;
	  } else if (x[0] == strToAtom('priority')) {
	    return am_true; //TODO
	  } else if (x[0] == strToAtom('monitor_nodes')) {
	    node_monitor_processes[c_p.name] = x[1];
	    return am_true;
	  } else return badarg_stacktrace(c_p, x[0])

	case am_is_process_alive:  
	  if (a!=1) break;
	  if (!is_pid(x[0])) return badarg_stacktrace(c_p, x[0]);
	  if (procs[x[0].value] == undefined) return am_false;
	  return am_true;

	  
	  //Distributed system
	  
	case am_is_alive: 
	  if (a!=0) break;
	  if (node_name == am_nonode_nohost) return am_false;
	  return am_true;

	case am_nodes: 
	  if (a!=1) break;
	  return arrayToList(node_names);

	case am_node: 
	  if (a!=0) break;
	  return node_name;

	case am_setnode: 
	  //TODO check args, handle x[1]
	  if (a == 2) {
	    node_name = x[0];
	    return am_true;
	  } else if (a == 3) {
//	    console.log("SETNODE"+pp(x[0])+pp(x[1]));
	    node_name = x[0];
	    return am_true;	    
	  }
	  break;

	  
	  //Memory
	  
	case am_garbage_collect:
	  if (a!=0) break;
	  //Not supported
	  return am_true;

	case am_memory: 
	  if (a!=0) break;
	  //Not supported
	  return 2<<27;

	  
	  //Timers

	case am_cancel_timer: 
	  if (a!=1) break;
	  //HACK
	  return am_true;


	  //Sending messages
	  
	case am_send_after:
	  //TODO check args
	  var to = x[1], msg = x[2];
	  setTimeout(function() { erlangSend(to, msg, []); }, x[0]);
	  return strToAtom('ok');

	case am_send: 
	  if (a!=3) break;
	  //TODO check args
	  return erlangSend(x[0], x[1], x[2]);

	case am_sign_exclamation:
	  if (a!=2) break;
	  if(is_atom(x[0]) || is_pid(x[0]) || is_tuple(x[0])) {
	    erlangSend(x[0], x[1], []);
	    return x[1];
	  }
	  return badarg_stacktrace(c_p, x[0]);
      

	  //Conversion to/from list
	  
	case am_list_to_pid:
	  if (a!=1) break;
	  //TODO return badarg_stacktrace if not <0.x.0>
	  if (is_nonempty_list(x[0])) {
	    var a = listToStr(x[0]);
	    return {type:am_pid, value:Number(a.split('.')[1])};
	  }
	  return badarg_stacktrace(c_p, x[0]);

	case am_pid_to_list: 
	  if (a!=1) break;
	  if(!is_pid(x[0])) return badarg_stacktrace(c_p, x[0]);
	  return strToList('<0.'+x[0].value+'.0>');
	  
	case am_list_to_float: 
	  if (a!=1) break;
	  //TODO handle NaN
	  if (!is_list(x[0])) return badarg_stacktrace(c_p, x[0]);
	  return {type:am_float, value:Number(listToStr(x[0]))};

	case am_float_to_list:
	  if (a!=1) break;
	  if (!is_float(x[0])) return badarg_stacktrace(c_p, x[0]);
	  return strToList(String(x[0].value)+'e+00');

	case am_list_to_integer: 
	  if (a!=1) break;
	  //TODO handle NaN
//	  console.log("LIST_TO_INTEGER: "+pp(x[0]));
	  if (!is_list(x[0])) return badarg_stacktrace(c_p, x[0]);
	  var str = listToStr(x[0]), n = Number(str);
	  if (isNaN(n)) return badarg_stacktrace(c_p, x[0]);
	  if (is_big(n)) return new Math.BigInt(str);
	  return n;

	case am_integer_to_list:
	  if (a!=1) break;
	  if (!is_integer(x[0])) return badarg_stacktrace(c_p, x[0]);
	  if (is_bignum(x[0])) return strToList(x[0].toString());
	  return strToList(String(x[0]<<5>>5));
	  
	case am_atom_to_list:
	  if (a!=1) break;
	  if (is_atom(x[0])) return strToList(atomToStr(x[0]));
	  return badarg_stacktrace(c_p, x[0]);
	  	  
	case am_list_to_atom:
	  if (a!=1) break;
	  if (!is_list(x[0])) return badarg_stacktrace(c_p, x[0]);
	  return strToAtom(listToStr(x[0]));
/*	  
	  var atom = '', list = x[0];
	  while (list != 2 << 27) {
	    //TODO handle improper lists
	    atom += String.fromCharCode(list.value);
	    list = list.next;
	  }
	  return strToAtom(atom);
*/
	case am_list_to_tuple:
	  if (a!=1) break;
	  if (!is_list(x[0])) return badarg_stacktrace(c_p, x[0]);
	  return listToArray(x[0]);
	  
	case am_tuple_to_list: 
	  if (a!=1) break;
	  if (!is_tuple(x[0])) return badarg_stacktrace(c_p, x[0]);
	  return arrayToList(x[0]);

	case am_list_to_binary: 
	  if (a!=1) break;
	  if (!is_list(x[0])) return badarg_stacktrace(c_p, x[0]);
	  return listToStr(x[0]);

	case am_binary_to_list:
	  if (a==1) {
	    if (!is_binary(x[0])) return badarg_stacktrace(c_p, x[0]);
	    return strToList(x[0]);
	  }
	  if (a==3) {
	    if (!is_binary(x[0])) return badarg_stacktrace(c_p, x[0]);
	    if (!is_integer(x[1])) return badarg_stacktrace(c_p, x[1]);
	    if (!is_integer(x[2])) return badarg_stacktrace(c_p, x[2]);
	    return strToList(x[0].substr(x[1]-1,x[2]-x[1]+1));
	  }
	  break;
	  
	case am_ref_to_list: 
	  if (a!=1) break;
	  if (!is_reference(x[0])) return badarg_stacktrace(c_p, x[0]);
	  return strToList('#Ref<0.0.0.'+x[0].value+'>');

	case am_port_to_list: 
	  if (a!=1) break;
	  //HACK
	  //      if(!is_port(x[0])) return badarg_stacktrace(c_p, x[0]);
	  return strToList('#Port<'+x[0].value+'.0>');
	
	case am_fun_to_list: 
	  if (a!=1) break;
	  if(!is_fun(x[0])) return badarg_stacktrace(c_p, x[0]);
	  return strToList('#Fun<0.'+x[0].value+'.0>');

	  
	  //Funs
	  
	case am_make_fun: 
	  if (a!=3) break;
	  //TODO check args
	  var mod = atomToModule(x[0]);
	  var ip = functionToIp(mod, x[1], x[2])
	  var f = {type: 'fun', 
	           ip: ip,
		   free: 0,
		   pid: {type:am_pid, value:c_p},
		   mod: mod,
		   arity: x[2],
		   value: mod.name+':'+pp(x[1])+'/'+x[2]+'@'+ip};
	  return f;
	  
	case am_fun_info: 
	  if (a!=2) break;
	  if(!is_fun(x[0])) return badarg_stacktrace(c_p, x[0]);
	  if(x[1]==strToAtom('module')) return [x[1], strToAtom(x[0].mod.name)];
	  if(x[1]==strToAtom('name')) return [x[1], strToAtom('undefined')]; //TODO
	  if(x[1]==strToAtom('arity')) return [x[1], x[0].arity];
	  if(x[1]==strToAtom('type')) return [x[1], strToAtom('local')]; 
	  if(x[1]==strToAtom('env')) return [x[1], arrayToList(x[0].free)]; 
	  if(x[1]==am_pid) return [am_pid, x[0].pid]; 
	  throw('unimplemented fun_info:'+ppx(x) );

	  
	  //Tuples
	  
	case am_make_tuple:
	  if (a!=2) break;
	  if (!is_integer(x[0]) && !is_small(x[0])) return badarg_stacktrace(c_p, x[0]);
	  var i, tp = new Array(x[0]);
	  for (i = 0; i < x[0]; i++) tp[i]=x[1];
	  return tp;
	  
	case am_setelement: 
	  if (a!=3) break;
	  //note: must copy array
	  if (!is_tuple(x[1])) return badarg_stacktrace(c_p, x[1]);
	  if (!is_integer(x[0])) return badarg_stacktrace(c_p, x[0]);
	  var i, pos = x[0], tp = []; 
	  for (i=0;i<x[1].length;i++) tp[i]=x[1][i]; 
	  tp[(x[0]<<5>>5)-1]=x[2];
	  return tp;

	      
           // Code loading and handling of modules
           
	case am_pre_loaded:
	  if (a!=0) break;
	  var i, res = [];
	  for (i in Modules)
	    if (is_atom(Number(i)))
	      if (atomToStr(Number(i)) != 'shell_default')
		res.push(Number(i));
	  return arrayToList(res);
	  
	case am_module_loaded:
	  if (a!=1) break;	  
	  if (!is_atom(x[0])) badarg_stacktrace(c_p, x[0]);
	  return atomToModule(x[0]) != undefined ? am_true : am_false;

	case am_load_module: 
	  if (a!=2) break;
	  //TODO Do not use beams! also check args
	  if (beams.indexOf(atomToStr(x[0])) == -1) return strToAtom('error');
	  return [strToAtom('module'), x[0]];
	  
	case am_function_exported: 
	  if (a!=3) break;
	  //Bifs are not considered exported
	  var mod = atomToModule(x[0]);
	  var fun = x[1];
	  var ar = x[2]<<5>>5;
	  if (mod == undefined) return am_false; 
	  if (mod.exports[fun] == undefined) return am_false; 
	  if (mod.exports[fun][ar] == undefined) return am_false;
	  return am_true;    
    
	case am_get_module_info: 
	  if (a==1) {
	    //TODO
	    if (is_atom(x[0])) 
	      return arrayToList([[strToAtom('exports'), 2<<27],
				 [strToAtom('imports'), 2<<27],
				 [strToAtom('compile'), 2<<27],
				 [strToAtom('attributes'), 2<<27]]);
	    badarg_stacktrace(c_p, x[0]);
	  } else if (a==2) {
	    //TODO
	    if (x[1] == strToAtom('module')) return x[0];
	    if (x[1] == strToAtom('attributes')) return 2<<27;
	    badarg_stacktrace(c_p, x[1]);
	  } else break;
	  
	  //Miscellaneous

	case am_display: 
	  if (a!=1) break;
	  //TODO
	  return am_true;
	  
	case am_bump_reductions: 
	  if (a!=1) break;
	  //Not supported
	  return am_true;

	case am_phash: 
	  if (a!=2) break;
	  var res = 0, str = x[0].toString();
	  for (var j = 0; j<str.length; j++) res += str.charCodeAt(j); 
	  return (res % x[1])+1;

	case am_make_ref:
	  if (a!=0) break;
	  return {type: 'ref', value:uniqueRef++}; 

	  
	  //iolists
	  
	case am_iolist_size:
	  if (a!=1) break;
	  if (!is_iolist(x[0])) return badarg_stacktrace(c_p, x[0]);
	  return iolist_to_binary(x[0]).length;
    

	case am_iolist_to_binary:
	  if (a!=1) break;
	  if (!is_iolist(x[0])) return badarg_stacktrace(c_p, x[0]);
	  return iolist_to_binary(x[0]);    


	  //Ports
	  
	case am_open_port:
	  if (a!=2) break;
	  return {type: 'port', value:x[0], owner:{type:am_pid, value:c_p.name}, 
	          options:x[1], msgs:[], file:''}; //value=e.g. {spawn, 'efile']

	case am_port_command:  
	  if (a!=2) break;
	  //All of port_command is a huge HACK
	  if (listToStr(x[0].value[1]) == 'efile') {
	    var command = iolist_to_binary(x[1]).charCodeAt(0);
	    var p_owner = procs[x[0].owner.value];
//         debugln1(c_p.name+': file command: '+pp(command)+pp(x[1]));
	    switch (command) {
	      case 1: 
		//file_open
		file_seek = 0;
		var f = listToStr(x[1].next.value);
		if (f == "/tmp/.erlang") {
		  // send enoent
		  p_owner.msgs.push( [ x[0], 
				     [strToAtom('data'), arrayToList([1, 101, 110, 111, 101, 110, 116])]]);
		  break;
		}
		x[0].file = f;
		p_owner.msgs.push([x[0],[strToAtom('data'), 
				  {value:3, next:arrayToList([0,0,0,0,0,0,0,7])}]]);
		break;
	      case 2: 
		    //file_read
		    //         debugln1(c_p.name+': file_read: '+pp(x[0])+pp(x[0].file));
			      
		    var c;
		    if (x[0].file == "/tmp/.erlang.cookie")
		      c=strToArray('QWERTY');
		    else
		      c = strToArray('{config,[]}.\n{event_handler,[]}.\n{ct_hooks,[]}.\n');
		    var l = arrayToList([2, 0,0,0,0, 0,0,0,48].concat(c)); 
		    if (file_seek++ == 0) p_owner.msgs.push([x[0],[strToAtom('data'), l]]);
		    else p_owner.msgs.push([x[0],[strToAtom('data'), 
		    {value:2, next:arrayToList([0,0,0,0,0,0,0,0,''])}]]);
		    break;
		  case 3: 
		    //lseek
		    //          debugln1('lseek: '+pp(x[1]));
		    //return epipe
		    p_owner.msgs.push([x[0],[strToAtom('data'),
				      arrayToList([1, 101, 112, 105, 112, 101])]]);
		    break;
		  case 4: 
		    //file_write
		    //          debugln1('file_write: '+pp(x[1]));
		    //return ok
		    p_owner.msgs.push([x[0],[strToAtom('data'), {value:0, next:2<<27}]]);
		    break;
		  case 5: 
		    //fstat
//		              debugln1('fstat: '+pp(x[1]));
		    
		    var file = listToStr(x[1].next.value);
		    switch (file) {
		      case '/tmp':
		      case '/otp_src_R14B04/lib/stdlib-1.0.0/ebin':
		      case '/otp_src_R14B04/lib/kernel-1.0.0/ebin':
		      case '/otp_src_R14B04/lib/common_test-1.0.0/ebin':
		      case '/otp_src_R14B04/lib/test_server-1.0.0/ebin':
		      case '/otp_src_R14B04/lib/xmerl-1.0.0/ebin':
		    //{file_info,4096,directory,read_write,{{2011,11,23,},{11,27,40,},},
		    //{{2011,10,15,},{11,1,28,},},{{2011,10,15,},{11,1,28,},},
		    // 16877,2,2053,0,1867855,1000,1000,}
			var info = [4, 0,0,0,0,0,0,16,0,0,0,0,2,0,0,7,219,
			0,0,0,11,0,0,0,23,0,0,0,11,0,0,0,27,0,0,0,40,
			0,0,7,219,0,0,0,10,0,0,0,15,0,0,0,11,0,0,0,1,
			0,0,0,28,0,0,7,219,0,0,0,10,0,0,0,15,0,0,0,11,
			0,0,0,1,0,0,0,28,0,0,65,237,0,0,0,2,0,0,8,5,0,
			0,0,0,0,28,128,79,0,0,3,232,0,0,3,232,0,0,0,3];
			p_owner.msgs.push([x[0],[strToAtom('data'), arrayToList(info)]]);
			break;
		      case '/tmp/.erlang.cookie':
		    //{file_info,5,regular,read_write,{{2011,11,23,},{11,27,40,},},
		    //{{2011,10,15,},{11,1,28,},},{{2011,10,15,},{11,1,28,},},
		    // 16832,2,2053,0,1867855,1000,1000,}
			var info = [4, 0,0,0,0,0,0,0,5,0,0,0,3,0,0,7,219,
			0,0,0,11,0,0,0,23,0,0,0,11,0,0,0,27,0,0,0,40,
			0,0,7,219,0,0,0,10,0,0,0,15,0,0,0,11,0,0,0,1,
			0,0,0,28,0,0,7,219,0,0,0,10,0,0,0,15,0,0,0,11,
			0,0,0,1,0,0,0,28,0,0,65,192,0,0,0,2,0,0,8,5,0,
			0,0,0,0,28,128,79,0,0,3,232,0,0,3,232,0,0,0,3];
			p_owner.msgs.push([x[0],[strToAtom('data'), arrayToList(info)]]);
			break;
		      default:
			//send enoent no matter what file is asked for
			p_owner.msgs.push( [ x[0], 
					   [strToAtom('data'), arrayToList([1, 101, 110, 111, 101, 110, 116])]]);
		    }
		    break;
		      case 6: 
			//cwd
//			          debugln1('cwd: '+pp(x[1]));
			//return '/tmp'
//			p_owner.msgs.push([x[0],[strToAtom('data'), arrayToList([9,47,116,109,112])]]);
			p_owner.msgs.push([x[0],[strToAtom('data'), arrayToList([9].concat(cdir))]]);
			break;
		      case 7: 
			//list_dir
//			          debugln1('list_dir: '+pp(x[1]));
			p_owner.msgs.push([x[0],[strToAtom('data'), {value:9, next:strToList('test_server-1.0.0')}]]);
			p_owner.msgs.push([x[0],[strToAtom('data'), {value:9, next:strToList('xmerl-1.0.0')}]]);
			p_owner.msgs.push([x[0],[strToAtom('data'), {value:9, next:strToList('common_test-1.0.0')}]]);
			p_owner.msgs.push([x[0],[strToAtom('data'), {value:9, next:strToList('kernel-1.0.0')}]]);
			p_owner.msgs.push([x[0],[strToAtom('data'), {value:9, next:strToList('stdlib-1.0.0')}]]);
			p_owner.msgs.push([x[0],[strToAtom('data'), {value:9, next:2<<27}]]);
			break;
		      case 8: 
			//chdir
			//          debugln1('ch_dir: '+pp(x[1]));
			//always return ok
			cdir = listToArray(x[1].next);
			p_owner.msgs.push([x[0],[strToAtom('data'), {value:0, next:2<<27}]]);
			break;
		      case 10: 
			//mk_dir
			//          debugln1('mk_dir: '+pp(x[1]));
			//always return ok
			p_owner.msgs.push([x[0],[strToAtom('data'), {value:0, next:2<<27}]]);
			break;
		      case 11: 
			//delete file
			//          debugln1('delete: '+pp(x[1]));
			//always return ok
			p_owner.msgs.push([x[0],[strToAtom('data'), {value:0, next:2<<27}]]);
			break;
		      case 15: 
			//get file
			//          debugln1('get_file: '+listToStr(x[1].next));
			if (listToStr(x[1].next)=='/otp_src_R14B04/bin/start.boot') {
//			  var b = new Uint8Array(bootFile), c = '';
//			  for (var i=0; i < b.length; i++) c += String.fromCharCode(b[i]);
                          var c = '';
			  for (var i=0; i < bootFile.length; i++) 
			    c += String.fromCharCode(bootFile.getByte(i)); 
//			  var s = String.fromCharCode(0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,20,210); 
			  c_p.msgs.push([x[0],[strToAtom('data'), {value:10, next:c}]]);
			} else {
			  //return enoent
			  p_owner.msgs.push( [ x[0], 
					     [strToAtom('data'), arrayToList([1, 101, 110, 111, 101, 110, 116])]]);
			}
			break;
		      case 23: 
			//file_close
			//          debugln1('file_close: '+pp(x[1]));
			//return ok
//			p_owner.msgs.push([x[0],[strToAtom('data'), {value:0, next:2<<27}]]);
			p_owner.msgs.push([x[0],[strToAtom('data'), arrayToList([0])]]);
			break;
			
		      default: throw 'unknown port_command: '+command;
	    }
	    return am_true;
	  } else {
	    //probably shell command, send exit
	    var p_owner = procs[x[0].owner.value];
	    p_owner.msgs.push([strToAtom('EXIT'), x[0], strToAtom('not_supported')]);
	    p_owner.msgs.push([strToAtom('EXIT'), x[0], strToAtom('not_supported')]);
	    return am_true;
	  }

	case am_port_control:  
	  if (a!=3) break;
	  //HACK get_geometry
	  //    debugln1('WARNING: HACK for port_control');
	  return arrayToList([0,0,0,80,0,0,0,25]); //80x25

	case am_port_connect:  
	  if (a!=2) break;
	  //TODO check args
	  x[0].owner = x[1];
	  return am_ok;
	  
	case am_port_close: 
	  if (a!=1) break;
	  //TODO
	  return am_true;

	  
	  //Monitors and links
	  
	case am_monitor: 
	  if (a!=2) break;
	  if (x[0]==strToAtom('process')) {
	    var mpid, pid = x[1];
	    if (is_atom(pid)) mpid = procs[reg_procs[pid].value];
	    else if (is_pid(pid)) mpid = procs[pid.value]; 
	    else if (is_tuple(pid) && is_atom(pid[0])) 
	      mpid = procs[reg_procs[pid[0]].value]; 
	    if (mpid != undefined) {
	      mpid.monitoring_me.push({pid:{type:am_pid, value:c_p.name}, 
				      ref:{type: 'ref', value:uniqueRef}});
	      c_p.iam_monitoring.push({pid:{type:am_pid, value:mpid.name}, 
				      ref:{type: 'ref', value:uniqueRef}});
	    } else erlangSend({type:am_pid, value:c_p.name}, 
		       [strToAtom('DOWN'), {type: 'ref', value:uniqueRef},
		       x[0], x[1], strToAtom('noproc')],[])
	    
	    return {type: 'ref', value:uniqueRef++};
	  } else return badarg_stacktrace(c_p, x[0]); 
	  
	case am_demonitor: 
	  if (a!=1 && a!=2) break;
	  //TODO check args
	case am_demonitor: 
	  for (var i = 0; i < c_p.iam_monitoring.length; i++) {
	    if (c_p.iam_monitoring[i].ref.value == x[0].value) {
	      var mpid = procs[c_p.iam_monitoring[i].pid.value];
	      c_p.iam_monitoring.splice(i,1);
	      if (mpid != undefined) {
		for (var j = 0; j < mpid.monitoring_me.length; j++) {
		  if (mpid.monitoring_me[j].pid.value == c_p.name) {
		    mpid.monitoring_me.splice(j,1);
		  }
		}  
	      }
	    } 
	  }
	  if (a == 2) {
	    //TODO: handle flush, etc
	  }
	  return am_true;
    
	case am_link:
	  if (a!=1) break;
	  if (is_port(x[0])) return am_true;
	  if (!is_pid(x[0])) return badarg_stacktrace(c_p, x[0]);
	  if (procs[x[0].value] != undefined) {
	    c_p.links.push(x[0]);
	    procs[x[0].value].links.push({type:am_pid, value:c_p.name});
	    return am_true;
	  } else if(is_external_pid(x[0])) { 
	    c_p.links.push(x[0]);
	    return am_true;
	  }
	  //PID does not exist
	  if (c_p.trap_exit == am_true) {
	    erlangSend({type:am_pid, value:c_p.name}, 
		       [strToAtom('EXIT'), 
		       x[0], strToAtom('noproc')],[]);
	    return am_true;
	  }
	  c_p.fault = true;
	  c_p.fault_class = strToAtom('error');
	  c_p.stacktrace = stacktrace(c_p);
	  return strToAtom('noproc'); 
	      
	case am_unlink:
	  if (a!=1) break;
	  if (is_port(x[0])) return am_true;
	  if (!is_pid(x[0])) return badarg_stacktrace(c_p, x[0]);
	  var i, lp = procs[x[0].value];
	  for(i = 0; i < c_p.links.length; i++) 
	    if (c_p.links[i].value == x[0].value) 
	      c_p.links.splice(i,1);
	    if (!lp) return am_true;
	    for(i = 0; i < lp.links.length; i++) 
	      if (lp.links[i].value == c_p.name) lp.links.splice(i,1);
	      return am_true;

	  
	  //Error handling
	  
	case am_get_stacktrace:
	  if (a!=0) break;
	  return c_p.stacktrace ? c_p.stacktrace: 2<<27;
	  
	case am_exit:
	  if (a==1) {
	    //    debugln1('exit: '+ppx(x)+':'+c_p.stacktrace);
	    c_p.fault = true;
	    c_p.stacktrace = false; 
	    c_p.fault_class = strToAtom('exit');
	    return x[0]; 
	  } else if (a==2) {
//	        debugln1(c_p.name+' exit/2: '+ppx(x)+':'+c_p.stacktrace);
	    erlangExit(c_p, x[0], x[1]);
            return am_true; 
	  } else break;
	  
	case am_error:
	  if (a==1) {
	    //    debugln1('error: '+ppx(x))
	    c_p.fault = true;
	    c_p.fault_class = strToAtom('error');
	    c_p.stacktrace = stacktrace(c_p);
	    return x[0]; 
	  } else if (a==2) {
	    //    debugln1('error: '+ppx(x))
	    c_p.fault = true;
	    c_p.fault_class = strToAtom('error');
	    c_p.stacktrace = {value:x[1], next:stacktrace(c_p)};
	    return x[0]; 
	  } else break;
	  
	case am_throw: 
	  if (a!=1) break;
	  //    debugln1('throw: '+ppx(x))
	  c_p.fault = true;
	  c_p.fault_class = strToAtom('throw');
	  return x[0];
	  
	case am_raise:
	  if (a!=3) break;
	  //    debugln1('raised: '+ppx(x))
	  c_p.fault = true;
	  c_p.fault_class = x[0];
	  c_p.stacktrace = x[2];
	  return x[1];
	  
	  
	  //Lists
	  
	case am_sign_plusplus: 
	  if (a!=2) break;
	  //TODO, check args, improper lists, etc
	  if (is_list(x[0]) && is_list(x[1]))
	    return arrayToList(listToArray(x[0]).concat(listToArray(x[1])));
	  if (x[0]==2<<27) return x[1]; 
	  else return badarg_stacktrace(c_p, x[0]);
	  
	case am_sign_minusminus:
	  if (a!=2) break;
	  var oldList = x[0];
	  var removeList = x[1];
	  if (!is_list(oldList)) return badarg_stacktrace(c_p, x[0]);
	  if (!is_list(removeList)) return badarg_stacktrace(c_p, x[1]);
	  if (removeList == 2 <<27 && listLen(oldList) == undefined) 
	    return badarg_stacktrace(c_p, x[0]);
	  while (removeList != 2<<27) { 
	    var list = 2 << 27;
	    var found = false;
	    while (oldList != 2<<27) {
	      if (oldList.value == undefined) return badarg_stacktrace(c_p, x[0]);
//	      if (!found && eq_exact(oldList.value, removeList.value)) found = true;
	      if (eq_exact(oldList.value, removeList.value)) {
		found = true;
		if (oldList.next != (2<<27) && oldList.next.next == undefined) 
		  return badarg_stacktrace(c_p, x[0]);
		oldList = listReverse(list, oldList.next);
		break;
	      }
	      else list = {value: oldList.value, next: list};
	      oldList = oldList.next;
	    }
//	    oldList = listReverse(list, 2<< 27);
	    if (!found) oldList = listReverse(list, 2<< 27);
	    removeList = removeList.next;
	    if (removeList == undefined) return badarg_stacktrace(c_p, x[1]);
	  }
	  return oldList; 

	  
	  //binary_to_term and term_to_binary
	  
	case am_term_to_binary:
	  if (a!=1) break;
	  return termToBinary(x[0]);
	  
	case am_binary_to_term:
	  if (a!=1) break;
	  if (is_binary(x[0])) {
	    var arr = strToArray(x[0]);
	    return arrayToTerm(arr); //Not efficient
	  }
	  return badarg_stacktrace(c_p, x[0]);


	  //Process registry
	  
	case am_put:
	  if (a!=2) break;
	  var e = c_p.registry[x[0]];
	  c_p.registry[x[0]] = [x[0],x[1]];
	  return (e==undefined) ? strToAtom('undefined') : e[1];  

	case am_get:
	  if (a==0) {
	    var e, result = []; 
	    for (e in c_p.registry) {
	      result.push(c_p.registry[e])
	    } 
	    return arrayToList(result);  
	  } else if (a==1) {
	    var e = c_p.registry[x[0]];
	    return (e[1]==undefined) ? strToAtom('undefined') : e[1];  
	  } else break;
	  
	case am_erase:
	  if (a!=1) break;
	  var e = c_p.registry[x[0]];
	  c_p.registry[x[0]] = undefined;
	  return (e==undefined) ? strToAtom('undefined') : e[1];  

	  
	  //Spawning processes
    
	case am_spawn_opt: 
	  if (a!=1) break;
	  //TODO check arg
	  x[3] = x[0][3]; //Options TODO
	  x[2] = x[0][2]; //arg list
	  x[1] = x[0][1]; //fun
	  x[0] = x[0][0]; //mod
	  return erlangSpawnOpt(c_p, m, x[0], x[1], x[2], x[3], false);

	case am_spawn: 
	  if (a!=3) break;
	  //TODO check arg
	  return erlangSpawn(c_p, x[0], x[1], x[2], false);
	  
	case am_spawn_link: 
	  if (a!=3) break;
	  //TODO check arg
	  return erlangSpawn(c_p, x[0], x[1], x[2], true);
      }
    case am_os:
      switch (f) {
	case am_timestamp:
	  if (a != 0) break;
	  var ms = Date.now(), s = div(ms, 1000), Ms = div(s,1000000);
	  nowUnique = nowUnique%998;
	  return [Ms, s%1000000, (ms%1000)*1000+nowUnique++];
	case am_getenv: 
	  //Not supported
	  if (a != 1) break;
	  if (eq(x[0], strToList('TEST_SERVER_FRAMEWORK'))) 
	    return strToList('ct_framework');
	  return am_false;
	case am_putenv: 
	  //Not supported
	  if (a != 2) break;
	  return am_true;
      }

    case am_ets:
//      console.log("ETS:"+pp(f)+"/"+a);
      switch(a) { 	  //TODO check args for all ets
	case 0:
	  switch(f) {
	    case am_all:
	      return ets_all();
	  }
	  break;
	case 1:
	  switch(f) {
	    case am_first:
	      return ets_first(x[0]);
	    case am_delete:
	      return ets_delete_1(x[0]);
	    case am_info:
	      if (ets_tables[x[0]] == undefined) return strToAtom("undefined"); 
	      return arrayToList([
	        [strToAtom('name'), ets_tables[x[0]].value],
	        [strToAtom('type'), ets_tables[x[0]].ets_type],
	        [strToAtom('size'), ets_tables[x[0]].slots.length],
	        [strToAtom('memory'), 0],
	        [strToAtom('owner'), ets_tables[x[0]].owner],
	        [strToAtom('protection'), ets_tables[x[0]].protection]]);
	  }
	  break;
	case 2:
	  switch(f) {
	    case am_delete_object:
	      return ets_delete_object(c_p, x[0], x[1]); 
	      
	    case am_new: 
	      return ets_new(c_p, x[0], x[1]);

	    case am_delete:
	      return ets_delete_2(x[0], x[1]);
	      
	    case am_select_delete:
	      return ets_select_delete(x[0], x[1]);

	    case am_select:
	      return ets_select(x[0], x[1]);
	      
	    case am_insert:
	      return ets_insert(x[0], x[1]);

	    case am_lookup:
	      return ets_lookup(x[0], x[1]);

	    case am_member:
	      if (is_nonempty_list(ets_lookup(x[0], x[1]))) return am_true;
	      return am_false;

	    case am_slot:
	      return ets_slot(x[0], x[1]);
    
	    case am_next:
	      return ets_next(x[0], x[1]);

	    case am_info:
	      if (x[1]==strToAtom('name')) return ets_tables[x[0]].value;
	      if (x[1]==strToAtom('type')) return ets_tables[x[0]].ets_type;
	      if (x[1]==strToAtom('size')) return ets_tables[x[0]].slots.length;
	      if (x[1]==strToAtom('memory')) return 0;
	      if (x[1]==strToAtom('owner')) return ets_tables[x[0]].owner;
	      if (x[1]==strToAtom('protection')) return ets_tables[x[0]].protection;
	      throw 'ets:info '+ppx(x);
	  
	    case am_match: 
	      //      debugln1('WARNING: HACK!!! (ets:match/2)')
	      return arrayToList([strToAtom('kernel-1.0.0'),strToAtom('common_test-1.0.0')]);

	    case am_match_object: 
	      //HACK
	      return 2<<27;
	  }
	  break;
	case 3:
	  switch(f) {
	    case am_lookup_element:
	      return 2<<27; //HACK
	  }
	  break;
      }
      break;
      
    case am_lists:
      switch(a) {
	case 2:
	  switch(f) {
	    case am_member: 
	      //TODO should use eq
	      if (!is_list(x[1])) return badarg_stacktrace(c_p, x[1]);
	      var list = x[1];
	      while (list != 2 << 27) { 
		if (x[0] == list.value) return am_true;
		list = list.next;
		if (list == undefined) return badarg_stacktrace(c_p, x[1]);
	      }
	      return am_false;
	      
	    case am_reverse:
	      if (!is_list(x[0])) return badarg_stacktrace(c_p, x[0]);
	      //    if (!is_list(x[1])) return badarg_stacktrace(c_p, x[1]); //TODO check arg2
	      return listReverse(x[0], x[1]);
	  }
	case 3:
	  switch(f) {
	    case am_keysearch:
	      if (!is_list(x[2])) return badarg_stacktrace(c_p, x[2]);
	      if (!is_integer(x[1]) || x[1] <= 0) return badarg_stacktrace(c_p, x[1]);
	      var list = x[2];
	      var keypos = (x[1]<<5>>5)-1;
	      var key = x[0];
	      while (list != 2 << 27) { 
		//TODO handle improper lists
		if (is_tuple(list.value) && 
		  keypos < list.value.length && 
		  eq(key, list.value[keypos])) return [strToAtom('value'), list.value];
		list = list.next;
	      }
	      return am_false;

	    case am_keyfind:
	      if (!is_list(x[2])) return badarg_stacktrace(c_p, x[2]);
	      if (!is_integer(x[1]) || x[1] <= 0) return badarg_stacktrace(c_p, x[1]);
	      var list = x[2];
	      var keypos = (x[1]<<5>>5)-1;
	      var key = x[0];
	      while (list != 2 << 27) {
		//TODO handle improper lists
		if (is_tuple(list.value) && 
		  keypos < list.value.length && 
		  eq(key, list.value[keypos])) return list.value;
		list = list.next;
	      }
	      return am_false;
    
	    case am_keymember:
	      if (!is_list(x[2])) return badarg_stacktrace(c_p, x[2]);
	      if (!is_integer(x[1]) || x[1] <= 0) return badarg_stacktrace(c_p, x[1]);
	      var list = x[2];
	      var keypos = (x[1]<<5>>5)-1;
	      var key = x[0];
	      while (list != 2 << 27) {
		//TODO handle improper lists
		if (is_tuple(list.value) && 
		  keypos < list.value.length && 
		  eq(key, list.value[keypos])) {return am_true;}
		  list = list.next;
	      }
	      return am_false;
	  }
      }
/*      
    case am_string:
      switch(f) {
	case am_to_integer: 
	  if (a != 1) break;
	  
      }
*/      
    case am_re: //HACK
      switch(f) {
	case am_run: 
	  if (a != 3) break;
	  var re, str;
	  if (is_list(x[0])) str = listToStr(x[0]);
	  else if (is_binary(x[0])) str = x[0];
	  else badarg_stacktrace(c_p, x[0]);
	  if (is_list(x[1])) re = new RegExp(listToStr(x[1]));
	  else if (is_binary(x[1])) re = new RegExp(x[1]);
	  else badarg_stacktrace(c_p, x[1]);
	  var first = str.search(re);
	  if (first >= 0) {
	    var last = first+str.match(re)[0].length-1;
	    return [strToAtom("match"), arrayToList([[first, last]])];
	  }
	  return strToAtom("nomatch");
      }

    case am_unicode:
      switch(f) {
	case am_bin_is_7bit:
	  if (a != 1) break;
	  //HACK
	  return am_true;

	case am_characters_to_binary:
	  if (a != 2) break;
	  if (!is_iolist(x[0])) return badarg_stacktrace(c_p, x[0]);
	  return iolist_to_binary({value:x[0], next:2<<27});

	case am_characters_to_list:
	  if (a != 2) break;
	  //TODO check args
	  if (!is_iolist(x[0])) return badarg_stacktrace(c_p, x[0]);
	  return strToList(iolist_to_binary({value:x[0], next:2<<27}));
      }
      break;
      
    case am_error_logger:
      if (a != 0) break;

      switch(f) {
	case am_warning_map:
	  return strToAtom('warning');
      }
      
    case am_net_kernel:
      switch(f) {
	case am_dflag_unicode_io: 
	  if (a != 1) break;
	  //not supported
	  return am_false;
      }
      
    case am_prim_file:
      if (a != 1) break;

      switch(f) {
	case am_internal_native2name: 
	  //not supported
	  return x[0];
	case am_internal_name2native: 
	  //not supported
	  return x[0];
      }
      
    case am_code:
      switch(f) {
	case am_get_chunk: 
	  if (a != 2) break;
	  //Not supported
	  return strToAtom('not_supported');
      }
      
    case am_file:
      switch(f) {
	case am_native_name_encoding:
	  if (a != 0) break;
	  return strToAtom('latin1');
      }
      
    case am_math:
      if (a != 1) break;
      
      switch(f) {
	case am_log10:
	  if (x[0]<=0 || x[0].value<=0) return badarg_stacktrace(c_p, x[0]);
	  if (is_float(x[0]))
	    return {type:am_float, value:Math.log(x[0].value)/Math.log(10)};
	  if (is_bignum(x[0]))
	    return {type:am_float, value:Math.log(x[0].doubleValue())/Math.log(10)};
	  return {type:am_float, value:Math.log(x[0])/Math.log(10)};

	case am_log:
	  if (x[0]<=0 || x[0].value<=0) return badarg_stacktrace(c_p, x[0]);
	  if (is_float(x[0]))
	    return {type:am_float, value:Math.log(x[0].value)};
	  if (is_bignum(x[0]))
	    return {type:am_float, value:Math.log(x[0].doubleValue())};
	  return {type:am_float, value:Math.log(x[0])};
      }
      
    case am_browserl_dist:
      switch(f) {
	case am_listen: 
	  try {
	    sockjs = new SockJS('/dist');
	    //  sockjs.onopen = function() {};
	    //  sockjs.onclose = function(e) {};
	    sockjs.onmessage = handle_distmessage;
	  } catch (e) {}
	  return [am_ok, [strToAtom("dummy@myhost"), am_true, am_true]];
	case am_accept: 
	  return [am_ok, [strToAtom("dummy2@myhost"), am_true, am_true]];
	case am_childspecs: 
	  return am_ok;
	default: debugln1("warning: unknown "+pp(f));
      }
      return am_true;

    case am_js:
      switch(f) {  
	/*
	 * js:eval(String) -> true
	 * String = string()
	 * 
	 * Example:
	 * js:eval("document.getElementById('first').innerHTML = 'some text'").
	 */

	case am_eval:
	  if (a!=1) break;
	  if (!is_list(x[0])) return badarg_stacktrace(c_p, x[0]);
	  try {
	    eval(listToStr(x[0]));
	    return am_true;
	  } catch (e) {
	    return badarg_stacktrace(c_p, x[0]);
	  }
	  
	/*
	 * js:call(JsObject, Function, Arguments) -> js_object()
	 * js:get(JsObject, Property) -> js_object()
	 * js:set(JsObject, Property, Value) -> true
	 * 
	 * JsObject = window | document | js_object()
	 * Function = atom()
	 * Property = atom() 
	 * Arguments = [ atom() ]
	 * Value = atom() | string() | js_object()
	 * 
	 * Examples:
	 * Doc = js:get(window, document). 
	 * MyElem = js:call(Doc, getElementById, [first]).
	 * MyElem = js:call(document, getElementById, [first]).
	 * OldContents = js:get(MyElem, innerHTML).
	 * js:set(MyElem, innerHTML, "some text").
	 * js:set(MyElem, innerHTML, OldContents).
	 */
	  
	case am_get:
	  if (a!=2) break;
	  var object, property, result;
	    
	  if (is_atom(x[0])) {
	    object = atomToStr(x[0]);
	    if (object == "window") object = window;
	    if (object == "document") object = document;
	  }
	  else if (is_pid(x[0]) && x[0].subtype == 'pseudoPid') object = x[0].value;
	  else return badarg_stacktrace(c_p, x[0]);
	  
	  if (is_atom(x[1])) property = atomToStr(x[1]);
	  else return badarg_stacktrace(c_p, x[1]);
	  
	  try {
	    result = object[property];
	    if (result == undefined) return badarg_stacktrace(c_p, x[1]);
	    return {type: am_pid, subtype: 'pseudoPid', value: result };
	  } catch (e) { 
	    return badarg_stacktrace(c_p, x[1]); 
	  }
	  
	case am_set:
	  if (a!=3) break;
	  var object, property, value;
	  
	  if (is_atom(x[0])) {
	    object = atomToStr(x[0]);
	    if (object == "window") object = window;
	    if (object == "document") object = document;
	  }
	  else if (is_pid(x[0]) && x[0].subtype == 'pseudoPid') object = x[0].value;
	  else return badarg_stacktrace(c_p, x[0]);
	  
	  if (is_atom(x[1])) property = atomToStr(x[1]);
	  else return badarg_stacktrace(c_p, x[1]);
	  
	  if (is_list(x[2])) value = listToStr(x[2]);
	  else if (is_atom(x[2])) value = atomToStr(x[2]);
	  else if (is_pid(x[2]) && x[2].subtype == 'pseudoPid') value = x[2].value;
	  else badarg_stacktrace(c_p, x[2]);
	  
	  try {
	    object[property] = value;
	    return am_true;
	  } catch (e) {
	    return badarg_stacktrace(c_p, x[1]);
	  }
	  
	case am_call:
	  if (a!=3) break;
	  var object, method, args1, args2 = [], result;
	  
	  if (is_atom(x[0])) {
	    object = atomToStr(x[0]);
	    if (object == "window") object = window;
	    if (object == "document") object = document;
	  }
	  else if (is_pid(x[0]) && x[0].subtype == 'pseudoPid') object = x[0].value;
	  else return badarg_stacktrace(c_p, x[0]);
	  
	  if (is_atom(x[1])) method = atomToStr(x[1]);
	  else return badarg_stacktrace(c_p, x[1]);
	  
	  if (!is_list(x[2])) return badarg_stacktrace(c_p, x[2]);
	  args1 = listToArray(x[2]);
	  for (i = 0; i < args1.length; i++)
	    if (!is_atom(args1[i])) return badarg_stacktrace(c_p, x[2]);
	    else args2.push(atomToStr(args1[i]));
	    
	    try {
	      result = object[method].apply(object, args2);
	      return {type: am_pid, subtype: 'pseudoPid', value: result };
	    } catch (e) {
	      return badarg_stacktrace(c_p, x[1]);
	    }
	    
      }      
  } 
  debugln1(c_p.name+'*** FAILED BifCall to '+pp([m,f,a])+' :'+ppx(x, 'x'));
  c_p.fault = true;
  c_p.fault_class = strToAtom('error');
  c_p.stacktrace={value:[m.atom, f, a], next:stacktrace(c_p)};
  return strToAtom('undef');  
}

function erlangSpawnOpt(c_p, emod, mod, fun, arg, opts, linked) { 
  if (eq(opts, arrayToList([am_monitor]))) {
    var pid = erlangSpawn(c_p, mod, fun, arg, linked);
    return [pid, bif(c_p, emod, am_monitor, 2, [strToAtom('process'), pid])];
  } else if (eq(opts, arrayToList([am_link]))) {
    return erlangSpawn(c_p, mod, fun, arg, true);
  } else if (eq(opts, arrayToList([]))) {
    return erlangSpawn(c_p, mod, fun, arg, false);
  }
  return badarg_stacktrace(c_p, opts);
}

function erlangSpawn(c_p, mod, fun, arg, linked) { 
//  debugln1(c_p.name+' spawns: '+hproc+':'+pp(mod+(2<<27))+':'+pp(fun+(2<<27))+'('+pp(arg)+')'+listLen(arg));
  var x1 = listToArray(arg);
  var links = linked ? [{type:am_pid, value:c_p.name}] : [];
  if (linked) c_p.links.push({type:am_pid, value:hproc})
  var p = { name:hproc, x:x1, y:[], ip:999999, r:x1[0], group_leader:c_p.group_leader, 
            mod:mod, fun:fun, ar:listLen(arg), cp:[], catches:[], 
            state:'runnable', msgs:[], registry:{}, monitoring_me:[],
	    iam_monitoring:[], links:links, initial_mod:mod, 
	    initial_fun:fun, initial_ar:x1.length};
  procs[hproc] = p;
  run_queue.push(p);
  return {type: am_pid, value: hproc++};
}

function erlangSend(to, msg, options) { //TODO handle options
    var receiver;
    if (is_pid(to)) {
      receiver = procs[to.value]; 
    } else if (is_atom(to)) { 
      var to_proc = reg_procs[to];
      if (to_proc == undefined) return am_false; //TODO should result in badarg?
      receiver = procs[to_proc.value]; 
      if (receiver == undefined) return am_false; //TODO should result in badarg?
    } else if(to.type == 'port') receiver = to; //port

//    if (to.subtype == 'pseudoPid') return sendToDOM(to, msg);
   
    if (receiver != undefined) {
//      debugln1(': Sending '+pp(msg)+' to '+pp(to)+'==='+pp(receiver.name)+' '+run_queue);
      receiver.msgs.push(msg);
//      if (receiver.state == 'waiting') receiver.state = 'runnable';
      receiver.state = 'runnable';
      run_queue.push(receiver);
    } else {
//      debugln1(': Sending external '+pp(msg)+" to "+pp(to));
      if (is_tuple(to) && sockjs) { //{pid, node}
	sockjs.send(btoa(termToBinary([6, to, msg])));
      } else if (is_atom(to.value[0])) {
	sockjs.send(btoa(termToBinary([2, to, msg])));
      }
    }
    return am_ok;
}

//TODO
function sendToDOM(to, msg) {
  throw "TODO";
}

function erlangExit(c_p, target, reason) {
//  debugln1(c_p.name+' kills '+pp(target)+' with reason '+pp(reason));
  if (procs[target.value]) {
    procs[target.value].fault = true;
    procs[target.value].stacktrace = false; 
    procs[target.value].fault_class = strToAtom('exit');
    procs[target.value].r = reason;
    procs[target.value].state = 'runnable'
    run_queue.push(procs[target.value]);
  }
}

function erlangApply(c_p, code, ip, r, x, mod, fun, ar) {
  
  if (code[ip]==102) { 
    //This goes via erlang.beam
    //apply(Fun, A) r=Fun, x1=A
    if (r.type == 'fun') {
      mod = r.mod; 
      ip  = r.ip;
      var len = r.free.length;
      ar = r.arity;
      var s1 = listToArray(x[1]);
      if (ar != s1.length) { 
	return badarity_stacktrace(c_p, r, x[1]);
      }
      if (ar > 0) {
	for (var j=0; j < ar; j++) { 
	  x[j] = s1[j];
	}
      }
      if (len > 0) {
	for (var j=0; j < len; j++) { 
	  x[j+ar] = r.free[j];
	}
      }
      if (ar + len > 0) r = x[0];
      return [c_p, r, mod, fun, ar, ip];
    } 
    //apply({M, F}, A)
      x[2] = x[1]; //A
      x[1] = r[1]; //F
      r = r[0]; //M
      mod = r;
      fun = x[1];
      ar = listLen(x[2]);
      if (ar == undefined) return badarg_stacktrace(c_p, x[2]);
	if (ar > 0) {
	  var tmp = listToArray(x[2]);
	  for (j=0; j < ar; j++) {
	    x[j] = tmp[j];
	  }
	  r = x[0];
	}
	return [c_p, r, mod, fun, ar, ip];
  } else if (code[ip]==103) { //This goes via erlang.beam
	    //apply(M, F, A), r=M,x1=F x2=A or
	    //{M, F}(A), r=M, x1=F, x2=A
	    mod = r; 
	    fun = x[1];
	    ar = listLen(x[2]);
	    if (ar == undefined) return badarg_stacktrace(c_p, x[2]);
	if (ar > 0) {
	  var tmp = listToArray(x[2]);
	  for (j=0; j < ar; j++) {
	    x[j] = tmp[j];
	  }
	  r = x[0];
	}
	return [c_p, r, mod, fun, ar, ip];
  } else {
    //M:F(A) or
    //{M, ...}:F(A), r={M, ...}, x1=F
    //{lists,y,z}:reverse(b). == lists:reverse(b,{lists,y,z})
    //{lists,y,z}:reverse(). == lists:reverse({lists,y,z})
    var t = code[ip];
    x[0]=r;
    if ( is_tuple(x[t])) { //{M, ...}:F(A)
	      mod = x[t][0];
	      fun = x[t+1];
	      ar = t+1;
	      return [c_p, r, mod, fun, ar, ip];
    }
    
    mod = x[t];
    fun = x[t+1];
    ar = t; 
    return [c_p, r, mod, fun, ar, ip];
  }
}

function whereis(pid) {
  var res = reg_procs[pid];
  return ((res == undefined) ? strToAtom('undefined') : res);
}


function atomToModule(atom) {
  return Modules[atom];
}

//WARNING will return undefined for improper lists (by design)!
function listLen(list) { 
  var len = 0;
  if (list == 2<<27) return 0;
  while (list != 2 << 27) {
    len++;
    list = list.next;
    if (list == undefined) return undefined;
  }
  return len;
}

function listLenImproperList(list) { 
  var len = 0;
  if (list == 2<<27) return 0;
  while (list != 2 << 27) {
    list = list.next;
    if (list == undefined) return len;
    len++;
  }
  return len;
}

function listReverse(oldList, list) { //TODO handle improper lists (badarg if first arg)
  while (oldList != 2 << 27) {
    list = {value: oldList.value, next: list};
    oldList = oldList.next;
  }
  return list;
}
function strToArray(str) {
  var a = [];
  for (var i = 0; i < str.length; i++) a[i] = str.charCodeAt(i);
  return a;
}

function strToList(str) {
  var result = 2 << 27;
  for(var i = str.length-1; i >= 0; i--) {
    result = { value: str.charCodeAt(i), next: result};
  }
  return result;
}

function iolist_to_binary(list) {
//  debugln1('iolist_to_binary:'+pp(list))
  var str = '';
  if (typeof list == 'string') return list;
  while (list != 2 << 27) {
    if (typeof list.value == 'string') str+=list.value;
    else if (list.value.next != undefined) str+=iolist_to_binary(list.value); 
    else if (typeof list.value == 'number') str += String.fromCharCode(list.value);
    else if (is_bignum(list.value)) str += String.fromCharCode(list.value.toString());
    else  throw 'faulty iolist';
    list = list.next;
  }
//  debugln1('iolist_to_binary result:'+str)
    return str;
}

function listToStr(list){ //TODO handle improper lists (badarg)
  var str = '';
  while (list != 2 << 27) {
    str += String.fromCharCode(list.value);
    list = list.next;
  }
  return str;
}

function arrayToList(arr) {
  var result = 2 << 27;
  for(var i = arr.length-1; i >= 0; i--) {
    result = { value: arr[i], next: result};
  }
  return result;
}

function listToArray(list) { //TODO handle improper lists (badarg?)
    var tp = [];
    while (list != 2 << 27) {
      tp.push(list.value);
      list = list.next;
    }
    return tp;
}

function improperListToArray(list) { 
    var tp = [];
    while (list != 2 << 27) {
      tp.push(list.value);
      list = list.next;
      if (list.next == undefined) {
	tp.push(list); 
	break;
      }
    }
    return tp;
}

function mkPid(id) {
  return {type:am_pid, value:id};
}

// WARNING: ETS functions are not really supported for now
// The following functions are just a hack to get the node up

function ets_new(c_p, name, opts) {
  ets_counter++;
  var nameOrNumber = name; //TODO
  var keypos=0;
  if (name == strToAtom('ct_suite_data')) keypos = 1;
  ets_tables[nameOrNumber] = {type:'ets_table', value:name, owner:mkPid(c_p.name), 
                              opts: opts, contents:{}, slots:[], keypos:keypos,
			      ets_type:strToAtom('set'), size:0, protection:strToAtom("public")};
//  debugln1('ets_new:'+pp(name)+'::::'+pp(opts));
  return name;
}

function ets_delete_1(name) {
//  debugln1('ets_delete:'+pp(name));
  var nameOrNumber = name; //TODO
  delete ets_tables[nameOrNumber]; 
  return am_true;
}
function ets_delete_2(name, key) {
//  debugln1('ets_delete2:'+pp(name)+'::::'+pp(key));
  var nameOrNumber = name; //TODO
  delete ets_tables[nameOrNumber].contents[key];
  ets_tables[nameOrNumber].size--;
  //TODO naive implementation of slots
  for (var i = 0; i < ets_tables[nameOrNumber].slots.length; i++) {
    if (eq_exact(ets_tables[nameOrNumber].slots[i], key)) 
      ets_tables[nameOrNumber].slots.splice(i, 1);
  }
  return am_true;
}
function ets_delete_object(c_p, name, object) {
//  debugln1('ets_delete_object:'+pp(name)+'::::'+pp(object));
  var keypos = ets_tables[name].keypos;
  var nameOrNumber = name; //TODO
  var key = object[keypos];
  delete ets_tables[nameOrNumber].contents[key];
  ets_tables[name].size--;
  //TODO naive implementation of slots
  for (var i = 0; i < ets_tables[nameOrNumber].slots.length; i++) {
    if (eq_exact(ets_tables[nameOrNumber].slots[i], key)) 
      ets_tables[nameOrNumber].slots.splice(i, 1);
  }
  return am_true;
}

function ets_select_delete(name, opts) {
//  debugln1('TODO ets_select_delete:'+pp(name)+'::::'+pp(opts));
  var nameOrNumber = name; //TODO
//  delete ets_tables[nameOrNumber]; //TODO
  return 0;
}

//TODO
//e.g. opts == [{{_,_,$1,},[{==,$1,<<pid##102>>,},],[$_,],},]
function ets_select(name, opts) {
//  debugln1('TODO ets_select:'+pp(name)+'::::'+pp(opts));
  var nameOrNumber = name; //TODO
  /*
  var head = opts[0];
  var guards = listToArray(opts[1]);
  var results = listToArray(opts[2]);
  if (guards[0] == strToAtom('==') && guards[1] == strToAtom('$1')) {
    if (head[0] == strToAtom('_') && head[0] == strToAtom('_') && head[0] == strToAtom('$1')) {
      
    }
  }
  */
  return 2<<27;
}

function ets_insert(table, objects) {
  var all = [objects];
  var keypos = ets_tables[table].keypos;
  if (is_list(objects)) all = listToArray(objects); 
  for (var i = 0; i < all.length; i++) {
    var object = all[i], key;
//    debugln1('ets_insert:'+keypos+":"+pp(object[keypos])+" "+pp(table)+'::::'+pp(object));
    if (is_list(object[keypos])) key = termToBinary(object[keypos]);
    else key = object[keypos];
    ets_tables[table].contents[key]=object;
    ets_tables[table].slots.push(object[keypos]);
    ets_tables[table].size++;
  }
  return am_true;  
}

function ets_lookup(table, key) {
  var result;
  
  if (is_list(key)) key = termToBinary(key);
  
  //Dirty HACK to avoid compiling when running tests
  if (table == strToAtom('ac_tab') && 
    eq(key, [strToAtom('env'), strToAtom('common_test'), strToAtom('auto_compile')])) {
      return {value:[key, am_false], next:2<<27};
    }
    

  result = ets_tables[table].contents[key];
//    debugln1('ets_lookup:'+pp(table)+'::::'+pp(key)+'-->'+pp(result));
  return (result == undefined) ? 2 << 27 : arrayToList([result]);
}

function ets_match(table, ms) { //TODO
//    debugln1('ets_match:'+pp(table)+'::::'+pp(ms));
  var slots = ets_tables[table].slots;
  var contents = ets_tables[table].contents;
  var result = [];
  for (var i = 0; i < slots.length; i++) {
    var object = contents[slots[i]];
//    debugln1('ets_match:'+pp(object));
  }
  return arrayToList([result]);
}


function ets_first(table) {
//  debugln1('ets_first:'+pp(ets_slot(table, ets_global)));
  var object = ets_slot(table, 0);
  if (object == 2 << 27 || object == strToAtom('$end_of_table')) return strToAtom('$end_of_table');
  return object.value[ets_tables[table].keypos];
}

function ets_next(table, key) {
  var slots = ets_tables[table].slots;
  for (var i = 0; i < slots.length-1; i++)
    if (slots[i] == key) return slots[i+1]; //TODO not very efficient
  return strToAtom('$end_of_table');
//  debugln1('ets_next'+pp(ets_slot(table, ets_global)));
}

function ets_slot(table, slot) {
  if (slot >= ets_tables[table].slots.length) return strToAtom('$end_of_table');
  var key = ets_tables[table].slots[slot]; 
  var object = ets_tables[table].contents[key];
//  debugln1('ets_slot:'+pp(table)+'::::'+pp(object)+'::::'+pp(result));
  return (object == undefined) ? 2 << 27 : arrayToList([object]);
}

function ets_all() {
  var tp = [];
  for (var j in ets_tables) tp.push(Number(j));
  return arrayToList(tp);
}



function stacktrace(c_p) {
  var i, tp = [];
  for (i=0; i < c_p.cp.length; i++) { 
    var mod = c_p.cp[i++];
    var funarg = ipToFunction(mod,c_p.cp[i]);
    tp.unshift([strToAtom(mod.name), strToAtom(funarg[0]), funarg[1]]);
  }
  return arrayToList(tp);
}

function ipToFunction(mod, ip) {
  var i = 0, currentFunction = '';
  while(i<ip && i < mod.code.length) {
    if (mod.code[i] == 2) currentFunction = [pp(mod.code[i+2]), mod.code[i+3]<<5>>5];
    i += ArityTable[mod.code[i]&255]+1;
  }
  return currentFunction;
}

function functionToIp(mod, fun, ar) {
  var i = 0;
  while(i < mod.code.length) {
    if (mod.code[i] == 2 && fun == mod.code[i+2] && ar == mod.code[i+3]) 
      return i+4;
    i += ArityTable[mod.code[i]]+1;
  }
  return -1;
}

function erl_idle() {
/*  if (timer_queue.length > 0) {
    if (timer_queue[0][0] < Date.now()) {
      var c_p = timer_queue[0][1];
      timer_queue.shift();
      if (c_p.timeout_ip != -1) {
	c_p.ip = c_p.timeout_ip;
	run_queue.push(c_p);
      }
    }
  } */
  if (run_queue.length > 0) erl_exec();
  else setTimeout(erl_idle, 100);
}

function term_callback(port, str){
  erlangSend(port.owner, [port, [strToAtom('data'), strToList(str)]]); 
}

function exec_port(port) {
  while (port.msgs.length > 0) {
    var msg = port.msgs.shift()[1];
    if (msg[0] != strToAtom('command')) throw 'strange io message to port '+pp(msg);
    var command = msg[1].value;
//    debugln1('out::::'+improperListToArray(msg[1]));
    term.write(port, improperListToArray(msg[1]));
  } 
  port.state = 'waiting';
}

function notifyAndDie(c_p, r, mod, ip) {
  /*
                    debugln1('*** Fault '+pp(c_p.fault_class)+' r = '+pp(r));
    		    debugln1('*** Process '+c_p.name+' died with reason '+pp(r));
    		    debugln1('*** message_queue '+pp(c_p.msgs));
    		    if (mod != undefined) debugln1("*** at:"+mod.name+":"+ipToFunction(mod, ip)+":"+pp(stacktrace(c_p)));
//    		    */
    var j;
    for (j=0; j < c_p.monitoring_me.length; j++) {
      erlangSend(c_p.monitoring_me[j].pid, 
		 [strToAtom('DOWN'), c_p.monitoring_me[j].ref, 
		 strToAtom('process'), 
		 {type:am_pid, value:c_p.name}, r],[]);
    }
    for (j=0; j < c_p.links.length; j++) {
//      if (r == strToAtom('kill'))
//	erlangExit(c_p, c_p.links[j], strToAtom('killed'));
//      else 
      var target = procs[c_p.links[j].value];
      if (target != undefined && target.trap_exit != am_true)
	erlangExit(c_p, c_p.links[j], r);
      else {
	if (r == strToAtom('kill')) r = strToAtom('killed'); 
	erlangSend(c_p.links[j], [strToAtom('EXIT'), 
		      {type:am_pid, value:c_p.name}, r],[]);
      }
    }
    delete procs[c_p.name];
    //TODO more cleanup, reg_procs, monitors, links, ets tables, etc
}

    
var run_queue = [], hproc = 0, ets_counter = 0, ets_tables = {};
var procs = [], reg_procs = {}, uniqueRef = 0, sockjs;

function run(mod, fun, args, files) {
  //Fake module for the JS bifs and distribution protocol
  Modules[am_js] = {atom:am_js, exports:{}}; 
  Modules[am_browserl_dist] = {atom:am_browserl_dist, exports:{}};

  loadFiles(files, mod, fun, args);
}

var debug = false, debug_pid = -1;
var ops =[];
/*** MAIN LOOP ***/

function erl_exec() {
  var code, imports, strings;
  
  var j, op, s1, s2, s3, need, r, tp, reds; 
  var x, y, fun, ar, name, mod, ip, c_p, fr = []; 
  
  //for bitstrings
  var bs_str, bs_size, bs_dst, bs_offs;

  //this function must always be used when target may be a register
  function g(arg) {
    switch (arg >>> 27) {
      case 5: return r;
      case 3: return x[arg<<5>>>5];
      case 4: return y[y.length-1-(arg<<5>>>5)];
      case 6: return mod.literals[arg<<5>>>5]
      default: return arg;
    }
  }

  function s(arg, val) {
    switch (arg >> 27) {
      case 5: r = val; break;
      case 3: x[arg<<5>>5] = val; break;
      case 4: y[y.length-1-(arg<<5>>5)] = val; break;
      default: 
	if (arg.type == 'fr') fr[arg.value] = val;
	else throw 'set unknown register';
    }
  }

  new_proc: while(true) {
    c_p = run_queue.shift();
    if (c_p == undefined) {
      setTimeout(erl_idle, 10);
      return;
    } else if (c_p.type == 'port') { 
      exec_port(c_p); 
      if (c_p.state == 'runnable') run_queue.push(c_p);
      continue new_proc; 
    } else if (procs[c_p.name] == undefined) continue new_proc;

    c_p.cmsg = 0;
    x = c_p.x;
    y = c_p.y;
    r = c_p.r;
    ip = c_p.ip;
    mod = c_p.mod;   //may be atom or object
    fun = c_p.fun;   //only valid if extcall
    ar  = c_p.ar;    //only valid if extcall
    name = c_p.name;
    reds = 10000;

  new_mod: while(true) {
    // We are here because:
    // 1. We are doing an external call, in this case mod is an atom and not an object
    // 2. We have run of reductions
    // 3. We have a fault
    if (typeof mod == 'number') { 
      var orig_mod = mod;
      mod = atomToModule(mod);
      if (mod == undefined) { 
	c_p.fault = true;
	c_p.fault_class = strToAtom('error');
	c_p.stacktrace = {value: [orig_mod,fun,2<<27], //TODO arity 
	                          next:stacktrace(c_p)};
	r = strToAtom('undef'); 
	debugln1('*** WARNING: undefined module: '+pp(orig_mod))
      } else {

///*
	if (debug || name == debug_pid){
	  debugln1("");
	  x[0]=r; debugln1(name+':ExtCall to ' + mod.name + ':'+ 
	              pp(fun) +'/'+ar+'@'+ip+' '+ppx(x)+' *** '+ppy(y));
	}
//*/	

        var exported_arities = mod.exports[fun];
        if (exported_arities == undefined || exported_arities[ar] == undefined) {
	  x[0] = r;
//	  var n = Date.now();
	  r = bif(c_p, mod, fun, ar, x);
//	  if (Date.now()-n > 30) 
//	    debugln1("Long time spent in bif "+pp(mod.atom)+":"+pp(fun)+ar);
	  ip = c_p.cp.pop();
	  mod = c_p.cp.pop();
	  if (mod == undefined && !c_p.fault) continue new_proc;
	} else {
	  ip = exported_arities[ar];
	}	
      }
    } 
    
    if (c_p.fault) 
      if (c_p.catches.length > 0) { 
	var c = c_p.catches.pop();
	ip = c.ip;
	mod = c.mod;
//			    debugln1('*** '+pp(c_p.fault_class)+':'+pp(r)+" in "+mod.name+"@"+ip+":"+
//			             ' in pid '+c_p.name+', caught by '+mod.name+'@'+ip);
	y.length = c.y;
	c_p.cp.length = c.cp_len;
	if (c_p.fault_class != strToAtom('throw'))
	  if (c_p.stacktrace) r = [strToAtom('EXIT'), [r, c_p.stacktrace]];
	  else r = [strToAtom('EXIT'), r];
	  c_p.fault = false;
	continue new_mod;
      } else {
	notifyAndDie(c_p, r, mod, ip);
	continue new_proc;
      }

    if (reds < 0) {
      c_p.x = x;
      c_p.y = y;
      c_p.r = r;
      c_p.ip = ip;
      c_p.mod = mod;
      c_p.fun = fun;
      c_p.ar = ar;
      if (c_p.state == 'runnable') run_queue.push(c_p);
      setTimeout(erl_idle, 1);
      return;
    }

    code = mod.code;
    imports = mod.imports;
    strings = mod.string;

    while(reds >= 0) {
      
	op = code[ip++];

//        if (ops[op] == undefined) ops[op] = 0;
//	ops[op]++;
	
/*
 	if (debug || name == debug_pid){
	  debug1(name + ':' + mod.name+':'+(ip-1)+' '+OpcodeNames[op]+'   ');
	  for (j = 0; j < ArityTable[op]; j++) debug1(pp(code[ip+j])+' ');
          debugln1(';;;'+pp(r)+'---'+ppx(x)+' --- '+ppy(y));
	}
//*/
	
	switch(op) {

        case 64: // move/2 Src Dst
           s(code[ip+1], g(code[ip]));
	   break;

   	case 125: //gc_bif2/6: Fail xx Op Arg1 Arg2 Dst
           s(code[ip+5], gc_bif2(c_p, code[ip+2], g(code[ip+3]), g(code[ip+4])));
	   if (!c_p.fault) break;
	   c_p.fault = false;
	   ip = code[ip];
	   continue;
	   
	case 56: // is_nonempty_list/2 Fail List=x
	  if (is_nonempty_list(g(code[ip+1]))) break;
	  ip = code[ip];
	  continue;
	   
	case 19:  // return/0 
	  ip = c_p.cp.pop();
	  if (ip == undefined) {
            notifyAndDie(c_p, strToAtom('normal'), mod, ip);
	    continue new_proc;
	  }
	  mod = c_p.cp.pop();
	  code = mod.code;
	  imports = mod.imports;
	  strings = mod.string;
	  if (debug || name == debug_pid ) debugln1('return to '+ipToFunction(mod, ip)+' r='+pp(r));
	  continue;

	case 65: // get_list/3  Src  Head  Tail
          s1 = g(code[ip]);
	  s(code[ip+1], s1.value);
	  s(code[ip+2], s1.next);
	  break;

	case 69: // put_list/3 S1 List Dst
           s2 = g(code[ip+1]);
	   if (is_binary(s2)) s2 = {value:s2, next: 2<<27};
	   s(code[ip+2], {value: g(code[ip]), next: s2});
	   break;

	case 4: // call/2 (Ar) F
	  c_p.cp.push(mod, ip + 2);                 //next opcode
	  /* !!!! fall through !!!! */
	case 6:   // call_only/2 (Ar) Func 
	  ip = code[ip + 1];
	  reds--;
///*	  
          if(debug || name == debug_pid) {
	    debugln1('');
	    debugln1(name+':call '+mod.name+'@'+ip+' ('+pp(code[ip-3])+
	    ':'+pp(code[ip-2])+'/'+pp(code[ip-1])+') r:'+pp(r)+' x:'+ppx(x));      
	  }
//*/
          continue;

        case 18: // deallocate/1 D
	  y.length -= code[ip];
	  break;

	case 13: // allocate_heap/3
	case 12:  // allocate/2: Need=any Regs=any  
	  y.length += code[ip];
	  break;
	  
	case 57: // is_tuple/2 Fail Tuple
	  if (is_tuple(g(code[ip+1]))) break;
	  ip = code[ip];
	  continue;

	case 43: //is_eq_exact Fail S1 S2
           s1 = g(code[ip+1]);
	   s2 = g(code[ip+2]);
	   if (eq_exact(s1, s2)) break;
	   ip = code[ip];
	   continue;

	case 61: // jump/1
	  ip = code[ip];
	  continue;
	  
	case 5:   // call_last/3: (Ar) Func D  
	  y.length -= code[ip + 2];
	  ip = code[ip + 1];
	  reds--;
///*	  
	  if (debug || name == debug_pid) {
	    debugln1(''); 
	    debugln1(name+':call last '+mod.name+'@'+ip+' ('+pp(code[ip-3])+
	    ':'+pp(code[ip-2])+'/'+pp(code[ip-1])+') r:'+pp(r)+' x:'+ppx(x));
	  }
//*/
	  continue;

	case 7:   // call_ext/2: (Ar) Func 
	  c_p.cp.push(mod, ip + 2);                 //next opcode
	  mod = imports[code[ip + 1]][0];
	  fun = imports[code[ip + 1]][1];
	  ar  = imports[code[ip + 1]][2];
	  continue new_mod;
	
	case 8: // call_ext_last/3: (Ar) Func D    
	  y.length -= code[ip + 2];
	  // fall through
	case 78:  // call_ext_only/2: (Ar) Func            
	  mod = imports[code[ip + 1]][0];
	  fun = imports[code[ip + 1]][1];
	  ar  = imports[code[ip + 1]][2];
	  continue new_mod;

	case 113: // apply_last/2 Ar D
	  y.length -= code[ip + 1];
	  // !!!! fall through !!!! 
	case 112: // apply/1 Ar
	  if (op==112) c_p.cp.push(mod, ip + 1);      //next opcode
          var res = erlangApply(c_p, code, ip, r, x, mod, fun, ar);
	  //[c_p, r, mod, fun, ar, ip]
	  if (c_p.fault) { 
	    r = res;
	    continue new_mod;
	  }
	  c_p = res[0];
	  r = res[1];
	  mod = res[2];
	  fun = res[3];
	  ar = res[4];
	  ip = res[5];
	  continue new_mod;


	case 15: // allocate_heap_zero/3
	case 14:  // allocate_zero/2: Need Regs
	  need = code[ip];
	  for (j = 0; j < need; j++) y.push(0);
	  break;
	  
	case 136: // trim/2 N (Remaining) 
	  y.length -= code[ip];
	  break;
	  
	case 16: // test_heap/2 I t TestHeap
	  break;

	case 17: // init/1 y
	  y[y.length-1-code[ip]] = 0;
	  break;

	case 70: // put_tuple/2 Ar Dst=r
	  tp = [];
	  s1 = ip + 1;
	  s2 = code[ip];
	  ip += 2;
	  while (s2--) {
	    if (code[ip] == 71) tp.push(g(code[ip+1])); 
	    else throw 'Unknown put';
	    ip += 2;
	  }
	  s(code[s1], tp); 
	  continue;

	case 39: //is_lt/3 Fail S1 S2  
          if (lt(g(code[ip+1]), g(code[ip+2]))) break;
          ip = code[ip];
          continue;

	case 40: //is_ge/3 Fail S1 S2 
          if (ge(g(code[ip+1]), g(code[ip+2]))) break;
	  ip = code[ip];
	  continue;

	case 41: //is_eq Fail S1 S2
           s1 = g(code[ip+1]);
	   s2 = g(code[ip+2]);
	   if (eq(s1, s2)) break;
	   ip = code[ip];
	   continue;

	case 42: //is_ne Fail S1 S2
           s1 = g(code[ip+1]);
	   s2 = g(code[ip+2]);
	   if (!eq(s1, s2)) break;
	   ip = code[ip];
	   continue;

	case 44: //is_ne_exact Fail S1 S2
           s1 = g(code[ip+1]);
	   s2 = g(code[ip+2]);
	   if (!eq_exact(s1, s2)) break;
	   ip = code[ip];
	   continue;

	case 124: //gc_bif1/5: Fail (Live) Operation S1 Dst
           s(code[ip+4], gc_bif1(c_p, imports[code[ip+2]], g(code[ip+3])));
	   if (!c_p.fault) break;
	   c_p.fault = false;
	   ip = code[ip];
	   continue;

	case 50: // is_reference/2 Fail Ref
	  if (is_reference(g(code[ip+1]))) break;
	  ip = code[ip];
	  continue;

	case 49: // is_pid/2 Fail Pid=x
	  if (is_pid(g(code[ip+1]))) break;
	  ip = code[ip];
	  continue;

	case 77: // is_function/2 Fail Fun=r
	  if (is_fun(g(code[ip+1]))) break;
	  ip = code[ip];
	  continue;

	case 115: // is_function2/3 Fail Fun=x Ar?
          s1 = g(code[ip+1]);
	  if (is_fun(s1) && s1.arity == (code[ip+2]<<5>>5)) break;
	  ip = code[ip];
	  continue;
	  
	case 51: // is_port/2
	  if (is_port(g(code[ip + 1]))) break;
	  ip = code[ip];
	  continue;

	case 45: // is_integer/2 Fail Int=x
          if (is_integer(g(code[ip+1]))) break;
	  ip = code[ip];
	  continue;

	case 46: // is_float/2 Fail S1=r
	  if (is_float(g(code[ip+1]))) break;
	  ip = code[ip];
	  continue;

	case 47: // is_number/2 Fail Number=r
	  if (is_number(g(code[ip+1]))) break;
	  ip = code[ip];
	  continue;

	case 48: // is_atom/2 Fail Atom=r
          if (is_atom(g(code[ip+1]))) break;
	  ip = code[ip];
	  continue;

	case 52: // is_nil/2 Fail List=r
	  if (g(code[ip+1]) == (2 << 27)) break;
	  ip = code[ip];
	  continue;

	case 53: // is_binary/2 Fail Bin=x 
	  if (is_binary(g(code[ip+1]))) break;
	  ip = code[ip];
	  continue;

	case 129: //'is_bitstr/2'
	  if (is_bitstring(g(code[ip+1]))) break;
	  ip = code[ip];
	  continue;

	case 114: // is_boolean/2 Fail Number
	  if (is_boolean(g(code[ip+1]))) break;
	  ip = code[ip];
	  continue;


	case 55: // is_list/2 Fail List=x
          s1 = g(code[ip+1]);
	  if (is_list(s1)) break;
	  ip = code[ip];
	  continue;

	case 58: // test_arity/3 Fail Tup=x Arity
	  if ( g(code[ip+1]).length == code[ip+2]) break;
	  ip = code[ip]; 
	  continue;

	case 66: // get_tuple_element/3 Tuple=x Pos Dst=x
	  s(code[ip + 2], g(code[ip])[code[ip + 1]]);
	  break;

 	case 67: // set_tuple_element/3 Elem=y Tuple=r, Pos //TODO must copy array?
          r[(code[ip+2]<<5>>5)] = g(code[ip]); //TODO: only r?
	  break;

	case 60: // select_tuple_arity/3 Tuple=x Fail SelectList
	   s1 = g(code[ip++]); 
	   s2 = code[ip++];
	   s3 = g(code[ip++]);
	   ip = s2;
	   for (j = 0; j < s3.length; j+=2) {
	     if (s3[j] == s1.length) { ip = s3[j+1]; break; }
	   }
	   continue;

	case 59: // select_val/3 SelectVal=x Fail SelectList
	  s1 = g(code[ip++]); 
	  s2 = code[ip++];
	  s3 = g(code[ip++]);
	  ip = s2;
	  for (j = 0; j < s3.length; j+=2) {
	    if (eq(s3[j], s1)) { ip = s3[j+1]; break; }
	  }
	  continue;

	  // Funs
	case 103: // make_fun2/1 Fun 
          var numFree = mod.funs[code[ip]][1];
	  var ar = mod.funs[code[ip]][2];
	  var free = (numFree == 0) ? [] : [r];
	  for (j = 1; j < numFree; j++) free.push(x[j])
	  r = {type: 'fun', //TODO: Always r?
	       ip: mod.funs[code[ip]][0],
	       free: free,
	       pid:{type:am_pid, value:c_p},
	       mod: mod,
	       arity: ar-numFree,
	       value: mod.name+'/'+ar+'@'+mod.funs[code[ip]]};
	  break;

	case 75: // call_fun/1 Fun
	  c_p.cp.push(mod, ip + 1);                 //next opcode
          var fun = (code[ip]==0) ? r : x[code[ip]];
	  if (!is_fun(fun)) {
	    badarg_stacktrace(c_p, fun);
	    continue new_mod;
	  }
	  mod = fun.mod
	  ip  = fun.ip;
	  var ar = fun.arity;
	  if (fun.free.length > 0) {
	    for (j=0; j < fun.free.length; j++) x[j+ar] = fun.free[j];
	    if (ar == 0) r = x[0];
	  }
	  continue new_mod;

	  // Try...catch
	case 104: // 'try'/2 S1=y Label
        //Fall through
	case 62: // 'catch'/2 S1=y Label
	  c_p.catches.push({mod:mod, ip:code[ip+1], 
			    cp_len:c_p.cp.length, 
		            y:y.length});
	  break;

	case 106: // try_case/1 S1=y
          if (c_p.fault_class==strToAtom('exit')) x[1]=r[1];
          if (c_p.fault_class==strToAtom('error')) x[1]=r[1][0];
	  if (c_p.fault_class==strToAtom('throw')) x[1] = r;
          r = c_p.fault_class;
	  break;
	  
        case 107:   // try_case_end/1 arg1=r
          c_p.fault = true;
          c_p.fault_class = strToAtom('error');
	  c_p.stacktrace = stacktrace(c_p);
	  r = [strToAtom('try_clause'), r]; //TODO always r?
          continue new_mod;
	
	case 105: // try_end/1 S1=y
          var t = c_p.catches.pop();
	  break;
	  
	case 63: // catch_end/1
          var t = c_p.catches.pop();
	  if (t != undefined && t.ip != ip-1) c_p.catches.push(t);
	  break;


	  // Bifs 
	case 9: // bif0/2 Bif Dst=x 
	  s(code[ip+1], bif0(c_p, imports[code[ip]]));
	  break;

	case 10: // bif1/4 Fail Bif S1 Dst
           s(code[ip+3], bif1(c_p, imports[code[ip+1]], g(code[ip+2])));
	   if (!c_p.fault) break;
	   c_p.fault = false;
	   ip = code[ip];
	   continue;

	case 11: // bif2/5: Fail Bif S1 S2 Dst
          s(code[ip+4], bif2(c_p, imports[code[ip+1]], g(code[ip+2]), g(code[ip+3])));
	  if (!c_p.fault) break;
	  c_p.fault = false;
	  ip = code[ip];
	  continue;

	  
	  // Messages
	case 20: // send/0 
          erlangSend(r, x[1], undefined);
	  r = x[1];
	  break;

	  //The receive loop
	  // loop_rec: peeks at a message                                              <+
	  // loop_rec_end: the message we peeked at did not match, shift queue and jump |
	  // wait, wait_timeout: no messages matched, schedule another process
	  // remove_message: a message matched, remove it and continue
	  // An example from prim_file
	  // receive Something -> ok
	  // after 0 -> ok
	  // end.
	  // 4435 loop_rec/2 4470 r 
	  // 4438 is_tuple/2 4468 r //or some other tests 
	  // 4461 remove_message/0 
	  // 4467 return/0 
	  // 4468 loop_rec_end/1 4435 
	  // 4470 timeout/0 //No messages matched after 0 seconds
	  // 4476 return/0 

	case 23: // loop_rec/2 Fail Msg=r (Fail = no message waiting)
	  if (c_p.msgs.length != 0) {
	    r = c_p.msgs[c_p.cmsg];
	    break;
	  }
	  ip = code[ip];
	  continue;
	  
	case 24: // loop_rec_end/1 Fail (Fail = more messages to check)
          c_p.cmsg += 1; 
	  if (c_p.cmsg > c_p.msgs.length) { c_p.cmsg = 0; break; } 
          
          ip = code[ip];
	  continue;
	  
	case 26: // wait_timeout/2 Label Timeout
          s2 = g(code[ip+1]);
	  if (s2 == 0) break;
	  if (s2!=strToAtom('infinity') && ! c_p.timer_ref) {
	    c_p.timer_ref = createTimeout(s2, c_p.name, ip+2);
//	    console.log("---"+c_p.name+": created timeout "+c_p.timer_ref+", timeout="+s2+", ip="+(ip+2));

	  }
	  //Fall through
	case 25: // wait/1 Label
	  c_p.y = y;
	  c_p.r = r;
	  c_p.ip = code[ip];
	  c_p.mod = mod;   
          c_p.state = 'waiting';
	  continue new_proc;

	case 22: // timeout/0
          if (c_p.timer_ref) { 
//	    console.log("---"+c_p.name+":clearing "+c_p.timer_ref);
            clearTimeout(c_p.timer_ref);
	    delete c_p.timer_ref;
	  }
          break;

	case 21: // remove_message/0
          if (c_p.timer_ref) { 
//	    console.log("---"+c_p.name+":removing message and clearing "+c_p.timer_ref);
	    clearTimeout(c_p.timer_ref);
	    delete c_p.timer_ref;
	  }
          c_p.msgs.splice(c_p.cmsg,1);
	  c_p.cmsg = 0;
	  break;

	case 150: // recv_mark/1 //TODO
	case 151: // recv_set/1  //TODO
          break;

	  //Floats
	case 94: //fclearerror //TODO
//          debugln1('fclearerror:'+fr)
          break;
	  
	case 95: //fcheckerror/1 //TODO
          if (isNaN(fr[g(code[ip])])) throw 'fcheckerror: NaN '+fr; 
	  break;
	   
	case 96: //fmove From=fr|reg|const Dst=fr|reg
           s1 = g(code[ip]);
           s2 = g(code[ip+1]);
//	   debugln1('fmove:'+s1+'='+pp(s1)+', '+s2+'='+pp(s2));
	   if (s2.type == 'fr') { 
	     if (s1.type == 'fr') { 
	       fr[s2.value] = fr[s1.value];
	     } else {
//	       s1 = g(s1);
	       if (is_float(s1)) fr[s2.value] = s1.value;
	       else fr[s2.value] = s1;
	     }
	   } else if (s1.type == 'fr') { 
//  	   debugln1('fmove2:'+fr[s1.value]);
	     s(code[ip+1], {type:am_float,value:fr[s1.value]});
	   } else {
	     throw 'Setting ordinary register with value from non-fr register'
	   }
	   break;

	case 97:  //fconv From Dst=fr
           fr[g(code[ip+1]).value] = g(code[ip]);
	   break;

	case 98: //fadd
           fr[g(code[ip+3]).value] = fr[g(code[ip+1]).value]+fr[g(code[ip+2]).value];
	   break;

	case 99: //fsub
           fr[g(code[ip+3]).value] = fr[g(code[ip+1]).value]-fr[g(code[ip+2]).value];
	   break;

	case 100: //fmul
           fr[g(code[ip+3]).value] = fr[g(code[ip+1]).value]*fr[g(code[ip+2]).value];
	   break;

	case 101: //fdiv Fail?? S1=fr, S2=fr, Dst=fr
           if(fr[g(code[ip+2]).value] == 0) throw 'div by zero'; //TODO
           fr[g(code[ip+3]).value] = (fr[g(code[ip+1]).value])/(fr[g(code[ip+2]).value]);
	   break;

	case 102: //fnegate/3 //TODO
           throw 'TODO: fnegate: '+ppx(x);

	   
	  // Binaries and Bitstrings
	  // A binary always contains a "complete number of bytes" [as per the documentation]
	  // Binaries are a subset of bitstrings
	  // Binaries are represented as js strings 
	  // bitstrings as {value:'js String', len:'bit length'}
	   
	case 116: // bs_start_match2/5 Fail Src Live Max/Slots Ms
          s1 = g(code[ip+1]);
          if (is_binary(s1)) { // A special case of bitstring
	    s(code[ip+4], {type:'matchspec_binary', bin: s1, offs: 0, len: s1.length*8 });
	    break;
	  } else if (is_bitstring(s1)) {
	    s(code[ip+4], {type:'matchspec_bitstring', bin: s1.value, offs: 0, len: s1.len });
	    break;
	  }
	  //Fail when not a binary of bitstring
	  ip = code[ip];
          continue;

	case 121: // bs_test_tail2/3 Fail Ms Len
          var ms = g(code[ip+1]);
	  var len = code[ip+2];
          if (ms.offs == ms.len-len) break;
	  ip=code[ip]; 
	  continue;

	case 120: //bs_skip_bits2/5 Fail Ms Size|all Unit Flags
          var ms = g(code[ip+1]);
          var sz = g(code[ip+2]);
          var u = g(code[ip+3]);
	  if (sz==strToAtom('all')) ms.offs = ms.len;
	  else if (ms.offs + sz*u > ms.len) {
	    ip = code[ip];
	    continue;
	  } else ms.offs += sz*u;
	  break;

	case 131: //'bs_test_unit/3' Fail Ms Unit
	  var ms = g(code[ip+1]);
	  if ((ms.len - ms.offs) % code[ip+2] == 0) break;
	  ip = code[ip];
	  continue;
	  
	case 117: // bs_get_integer2/7 Fail Ms=x Live Size Unit Flags Dst=x
         var sz = g(code[ip+3]);
	 var u = g(code[ip+4]);
         var bits = sz*u;
         var ms = g(code[ip+1]);
	 if (sz==strToAtom('all')) throw "bitstring match not yet implemented (3)"
	 if (ms.offs + bits > ms.len) {
	   ip=code[ip]; 
	   continue;
	 } 
	 var value = 0;
	 while (bits > 0) {
	   var byte = div(ms.offs,8);
	   var boffs = ms.offs % 8;
	   var bsize = bits > 8 ? 8 - boffs : bits;
	   value += (ms.bin.charCodeAt(byte) << boffs >>> 8 - bsize)*Math.pow(2, bits-bsize); 
	   bits -= bsize;
	   ms.offs += bsize;
	}
	if (is_big(value)) value = Math.BigInt.valueOf(value); //TODO: too late to check here
	s(code[ip+6], value);
	break;

	case 119: // bs_get_binary2/7 Fail Ms=x Live Size|all Unit Flags Dst=x
         var sz = g(code[ip+3]);
	 var u = g(code[ip+4]);
         var bits = sz*u;	 
         var ms = g(code[ip+1]);
	 if (sz==strToAtom('all')) {
	   bits = ms.len - ms.offs;
	   ms.offs = ms.len;
	 } else if (ms.offs + bits > ms.len) {
	   ip = code[ip]; 
	   continue;
	 } else ms.offs += bits;
	 //TODO: ms.offs might not be evenly divisible by 8!
	 //TODO: bits might not be evenly divisible by 8!
	 if (bits % 8 != 0) throw "bitstring match not yet implemented (4):" + bits;
	 if ((ms.offs-bits) % 8 != 0) throw "bitstring match not yet implemented (5):" + ms.offs;
	 s(code[ip+6], ms.bin.substr(div(ms.offs-bits,8), div(bits,8))); 
         break;

	case 132: // bs_match_string/4 Fail Ms=x Bits Offs
	  var bits = g(code[ip+2]);
	  var bytes = div(bits, 8);
	  var ms = g(code[ip+1]);
	  //TODO: ms.offs may not be evenly divisible by 8!
	  //TODO: bits may not be evenly divisible by 8!
	  if (bits != bytes*8) throw "bitstring match not yet implemented (1)";
	  if (ms.offs % 8 != 0) throw "bitstring match not yet implemented (2)";
	  if (bits + ms.offs <= ms.len) {
	    s1 = strings.substr(code[ip+3], bytes);
	    s2 = ms.bin.substr(div(ms.offs,8), bytes);
	    ms.offs += bits;
	    if (s1 == s2) break;
	  }
	  ip = code[ip];
	  continue;

        case 138: //bs_get_utf8/5 //HACK
          var ms = g(code[ip+1]);
	  if (ms.offs + 8 <= ms.len) {
	    s(code[ip+4], ms.bin[div(ms.offs,8)]);
	    ms.offs += 8;
	    break;
	  }
	  ip = code[ip];
	  continue;

	case 139: //'bs_skip_utf8/4' Fail Ms Size|all Unit Flags
          var ms = g(code[ip+1]);
	  if (ms.offs + 8 <= ms.len) {
	    ms.offs += 8;
	    break;
	  }
	  ip = code[ip];
	  continue;
	  
	 //Creating binaries and bitstrings

	case 111: // bs_add/5 Fail S1=#units S2='extra bits'? Unit Dst
         s1 = g(code[ip+1]);	   
         s2 = g(code[ip+2]);
         var unit = g(code[ip+3]);
	 if (is_integer(s1) && is_integer(s2) && is_integer(unit) && s1*unit+s2 < (2 << 27)) {
	   s(code[ip+4], s1*unit+s2);
	   break;
	 }
	 ip = code[ip];
	 continue;

	case 137: //bs_init_bits/6 Fail Sz=#bits Words Regs Flags Dst=x
         bs_str = '';
	 bs_size = g(code[ip+1]);
	 bs_dst = code[ip+5];
	 bs_offs = 0;
	 if (is_integer(bs_size)) break;
	 ip = code[ip];
	 continue;

	case 109: // bs_init2/6 Fail Sz Words Regs Flags Dst=x
          bs_str = '';
	  bs_size = g(code[ip+1])*8;
	  bs_dst = code[ip+5];
 	  bs_offs = 0;
	  if (is_integer(bs_size)) break;
	  ip = code[ip];
	  continue;

	case 134: //'bs_append/8'  Fail Size Extra Live Unit Bin Flags Dst
          bs_str = g(code[ip+5]);
	  bs_size = g(code[ip+1])*g(code[ip+4]);
	  bs_dst = code[ip+7];
          bs_offs = 0;
	  if (is_integer(bs_size)) break;
	  ip = code[ip];
	  continue;

	case 135: //'bs_private_append/6' Fail Size Unit Bin Flags Dst
          bs_str = g(code[ip+3]);
	  bs_size = g(code[ip+1])*g(code[ip+2]);
	  bs_dst = code[ip+5];
	  bs_offs = 0;
	  if (is_integer(bs_size)) break;
	  ip = code[ip];
	  continue;

	case 91: // bs_put_float/5 Fail Sz Unit Flags Src
	  var bits = g(code[ip+1])*g(code[ip+2]); 
	  if (bits == 64 || bits == 32) {
	    var a = floatToArray(g(code[ip+4]).value, bits);
	    for (var i = 0; i < a.length; i++) bs_str+= String.fromCharCode(a[i]);
	    bs_offs += bits;
	    if (bs_offs == bs_size) s(bs_dst, bs_str);
	    if (bs_offs > bs_size) throw "appending bitstring to offs > size";
	    break;
	  }
	  ip = code[ip];
	  continue;
	  
	case 92: // bs_put_string/2 Len Offs
	  var bytes = g(code[ip]);
	  bs_str += strings.substr(code[ip+1],bytes);
	  bs_offs += bytes*8;
	  if (bs_offs == bs_size) s(bs_dst, bs_str);
          if (bs_offs > bs_size) throw "appending bitstring to offs > size";
	  break;
	  
	case 89: // bs_put_integer/5 Fail Size Unit Flags Src=x 8 1 0 1
          //TODO bigints
          var bytes = div(g(code[ip+1])*g(code[ip+2]), 8);
	  s1 = g(code[ip+4]);
	  s2 = '';
	  for (j = 0; j < bytes; j++) {
	    s2 += String.fromCharCode(s1&255);
	    s1 = s1 >> 8;
	  }
	  bs_str += s2.split('').reverse().join(''); //TODO optimize me
	  bs_offs += bytes*8;
	  if (bs_size == bs_offs) s(bs_dst, bs_str);
          if (bs_offs > bs_size) throw "appending bitstring to offs > size";
	  break;
	 //TODO: fail?
		
	case 90: //bs_put_binary/5 Fail Size|all Unit Flags Src
          var sz = g(code[ip+1]);
	  var src = g(code[ip+4]);
	  if (sz==strToAtom('all')) {
	    bs_str += src;
	    bs_offs += src.length*8;
	  } else {  
	    var bytes = div(sz*g(code[ip+2]), 8);
	    bs_str += src.substr(0,bytes);
	    bs_offs += bytes*8;
	  }
	  if (bs_offs == bs_size) s(bs_dst, bs_str);
          if (bs_offs > bs_size) throw "appending bitstring to offs > size";
	  break;
	 //TODO: fail?
	  
	case 123: // bs_restore2/2 Offs Reg //TODO
          g(code[ip]).offs = g(code[ip]).saved_offs
          break;
	case 122: // bs_save2/2 Offs Reg //TODO
          g(code[ip]).saved_offs = g(code[ip]).offs
          break;


	case 130: // bs_context_to_binary/5
           r = r.bin;
	   if (r == undefined) {
	     c_p.fault = true;
	     c_p.fault_class = strToAtom('error');
	     c_p.stacktrace = stacktrace(c_p);
	   }
	   break;

	case 133: //'bs_init_writable/0' //TODO
           break;
	   
	case 110: //'bs_bits_to_bytes/3'
	case 118: //'bs_get_float2/7'
	case 126: //'bs_final2/2'
	case 127: //'bs_bits_to_bytes2/2'
	case 128: //'put_literal/2'
	  //utf8,16,32 support
	case 140: //'bs_get_utf16/5'
	case 141: //'bs_skip_utf16/4'
	case 142: //'bs_get_utf32/5'
	case 143: //'bs_skip_utf32/4'
	case 144: //'bs_utf8_size/3'
	case 145: //'bs_put_utf8/3'
	case 146: //'bs_utf16_size/3'
	case 147: //'bs_put_utf16/3'
	case 148: //'bs_put_utf32/3'
          throw "Unimplemented bitstring opcode:"+(op)+':'+OpcodeNames[op];
	  
	  
	  // Faults
	case 74: // case_end/1 Unmatched
          c_p.fault = true;
          c_p.fault_class = strToAtom('error');
	  c_p.stacktrace = stacktrace(c_p);
	  r = [strToAtom('case_clause'), g(code[ip])];
	  continue new_mod;

	case 73: // if_end/0
          c_p.fault = true;
          c_p.fault_class = strToAtom('error');
	  c_p.stacktrace = stacktrace(c_p);
	  r = strToAtom('if_clause');
	  continue new_mod;

	case 72: // badmatch/1 A=r
          c_p.fault = true;
          c_p.fault_class = strToAtom('error');
	  c_p.stacktrace = stacktrace(c_p);
	  r = [strToAtom('badmatch'), g(code[ip])];
	  continue new_mod;
	  
	case 108: //'raise/2' //TODO???
	  c_p.fault = true;
	  c_p.fault_class = r;
	  c_p.stacktrace = stacktrace(c_p);
	  r = g(code[ip+1]);
	  continue new_mod;
	  
	case 1:
	  throw 'Unexpected op code normally used for labels';

	case 2: // We end up here if no matching function clause
	  var arity = code[ip+2];
	  var args = [];
	  for (j = 0; j < arity; j++) { 
	    args.push(x[j]);
	  }
          c_p.fault = true;
          c_p.fault_class = strToAtom('error');
	  c_p.stacktrace = {value:[code[ip], code[ip+1], arrayToList(args)], next:2<<27};
	  r = strToAtom('function_clause');
	  continue new_mod;

	case 3: // int_code_end/0
	  throw 'Unexpected fatal, reached code end';

	  /* missing ops 
	  //The following do not exist in stdlib or kernel
	case 54: 'is_constant/2'
	case 68: 'put_string/3'
	case 76: 'make_fun/3'
	case 149: 'on_load/0'
	case 152: 'gc_bif3/7'
	  //obsolete?
	case 27 'm_plus/4'
	case 28: 'm_minus/4'
	case 29: 'm_times/4'
	case 30: 'm_div/4'
	case 31: 'int_div/4'
	case 32: 'int_rem/4'
	case 33: 'int_band/4'
	case 34: 'int_bor/4'
	case 35: 'int_bxor/4'
	case 36: 'int_bsl/4'
	case 37: 'int_bsr/4'
	case 38: 'int_bnot/3'
	  //old binary, obsolete?
	case 79: 'bs_start_match/2'
	case 80: 'bs_get_integer/5'
	case 81: 'bs_get_float/5'
	case 82: 'bs_get_binary/5'
	case 83: 'bs_skip_bits/4'
	case 84: 'bs_test_tail/2'
	case 85: 'bs_save/1'
	case 86: 'bs_restore/1'
	case 87: 'bs_init/2'
	case 88: 'bs_final/2'
	case 93: 'bs_need_buf/1'
	  */
	default: 
	  throw ip-1+': missing case '+(op)+':'+OpcodeNames[op];
	}
	ip += ArityTable[op];
      }
    } //new_mod
  } //new_proc
} //run

function createTimeout(timeout, p, ip) {
  return setTimeout(function () {
    if (procs[p]) {
      procs[p].ip = ip;
      run_queue.push(procs[p]);
//      console.log("---"+p+":timeout fired after "+timeout+" ms at ip="+ip);
    }
  }, Number(timeout));
}

function handle_distmessage(e) {
    var str = atob(e.data);  
    var msg = arrayToTerm(strToArray(str));
    var ctrl = msg[0];
//console.log("Got data from other node:" +pp(msg[0]));
    
    switch (ctrl[0]) {
      case 6: 
	//send message to registered process 
	var rcvr = ctrl[3];
//	      console.log("Got data from other node, sending " +pp(msg[1])+" to "+pp(rcvr))
	erlangSend(rcvr, msg[1], false);
	break;
      case 2: 
	//send message to pid
	var rcvr = ctrl[2];
//	      console.log("Got data from other node, sending " +pp(msg[1])+" to "+pp(rcvr))
	erlangSend(rcvr, msg[1], false);
	break;
      case 19: 
	//monitor pid
      case 20: 
	//demonitor pid
	break;
      case 97: 
	//nodeup
	var server_name = ctrl[1];
	for (var i in node_monitor_processes) {
	  erlangSend({type: am_pid, value:Number(i)}, [strToAtom('nodeup'), server_name]);
	}
	node_names.push(server_name);
	if (sockjs)
	  sockjs.send(btoa(termToBinary([97, node_name])));
	else debugln1("could not send dist message");
	break;
      case 98: 
	//server net_kernel pid
	break;
      case 99: 
	//ping TODO should go to net_kernel
	var to = ctrl[1];
	erlangSend(to, [strToAtom("ping")]);
  }
}

//Debugging help
var zz = '';
function debugln1(s) { 
  if (window.console) console.log(zz+s);
  try { 
    document.getElementById("statusconsole").innerHTML = s;
  } catch (e) {}
//  else term.write(-1, [2, zz+s+"\n"]); //This line does not work in konqueror
//  term.write(-1, [2, zz+s+"  "]); //This line does not work in konqueror
  zz='';
}
function debug1(s) { 
  zz+=s; 
}

function ppx(x) {
  if (x instanceof Array) {
    var s = '', i;
    for (i = 0; i < x.length; i++) {
      if (x[i]==undefined) continue;
      s+='x'+i+'='+pp(x[i])+',';
    }
    return s+'';
  }  
}

function ppy(y) {
  if (y instanceof Array) {
    var s = '', i;
    for (i = 0; i < y.length; i++) {
      if (y[i]==undefined) continue;
      s+='y'+(i)+'='+pp(y[y.length-1-i])+',';
    }
    return s+'';
  }  
}

function pp(xx) {
  if (xx == undefined) return 'pp-undefined';
  
  //lists
  if ( xx.next != undefined ) { 
    var i=0, c, s='[', as='\'', all_printable=true;
    while (xx != (2 << 27) && xx != undefined) {
      s += pp(xx.value) + ',';
      i++;
      c = String.fromCharCode(xx.value);
      if (c < ' ' || xx.value > 255) all_printable = false;
      if (all_printable) as += c;
      if (i > 60) { s+= '...'; as+='...'; break;}
      xx = xx.next;
    }
    if (all_printable) return as+'\'';
    return s+']';
  } 

  //tuples
  if (xx instanceof Array) {
    var s = '{', i;
    for (i = 0; i < xx.length; i++) s+=pp(xx[i])+',';
    return s+'}';
  }

  //binaries
  if (typeof xx == 'string') {
    var s = xx.substr(0,80);
//    return xx == s ? '<<'+strToArray(s)+'>>' : '<<'+strToArray(s)+'...>>';
    return xx == s ? '<<'+s+'>>' : '<<'+s+'...>>';
  }
  //bigints
  if( xx instanceof Math.BigInt) return 'bigint##'+xx.toString();

  //pids
  if (xx.type == am_pid) return '<<pid##'+(xx.value)+'>>';

  //other objects
  if (xx.type != undefined) return "<<"+xx.type+'##'+xx.value+">>";



  if (typeof xx == 'number') {
    if (xx < 0) return xx;
    if (Math.round(xx) != xx) return xx;
    else {
      var val = (xx<<5)>>5;
      switch(xx >> 27) {
	case 0:
	case 1: return val;
	case 2: return atomToStr(xx);
	case 3: return 'x'+val+' ';
	case 4: return 'y'+val+' ';
	case 5: return 'r';
//	case 6: return 'h'+val;
	case 6: return 'literal##'+val;
	default: throw 'unknown type in pp';
      }
    }
  } else if(typeof xx == 'function') {
    return 'gc_bif '+xx;
  } 
  else { console.debug(xx); }
//    throw 'unknown type '+ typeof xx +' in pp';}
}

function disasm(Mod, ip) {
  var Code1 = Mod.code;
  var op, opargs, j;
  for (; ip < Code1.length;) {
    op = Code1[ip++]&255;
    debug1(ip-1+' '+OpcodeNames[op]+' ');

    for (j = 0; j < ArityTable[op]; j++, ip++) {
      debug1(pp(Code1[ip])+' ');
    }
    debugln1('');
    if (op == 2) break;
  }   
}
