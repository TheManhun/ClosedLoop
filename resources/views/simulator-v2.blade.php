@extends('layouts.app')

@section('title', 'Simulator V2')

@section('content')
    <div id="closed-loop-v2-root">
        <div id="closed-loop-v2-canvas" style="width:100%;height:100%;"></div>
        <div id="closed-loop-v2-ui" style="white-space: pre-wrap; font-family: monospace; padding: 1rem;"></div>
    </div>
@endsection

@section('scripts')
    @vite(['resources/js/v2/main.js'])
@endsection
