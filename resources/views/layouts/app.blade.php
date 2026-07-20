<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>@yield('title', 'Closed Loop')</title>
    <style>
        body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0}
        header{background:#0f172a;color:#fff;padding:0.75rem}
        nav a{color:#fff;margin-right:1rem;text-decoration:none}
        main{padding:1.25rem}
    </style>
</head>
<body>
    <header>
        <nav>
            <a href="{{ route('home') }}">Home</a>
            <a href="{{ route('simulator') }}">Simulator</a>
            <a href="{{ route('about') }}">About</a>
        </nav>
    </header>
    <main>
        @yield('content')
    </main>
</body>
</html>
