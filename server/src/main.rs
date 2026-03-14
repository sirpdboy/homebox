use actix_web::{
    get, head, http::header::ContentType, middleware, options, post, web, App, Error, HttpRequest,
    HttpResponse, HttpServer, Responder,
};
use clap::{command, Args, Parser, Subcommand};
use futures::{stream::poll_fn, task::Poll, StreamExt};
use include_dir::{include_dir, Dir};
use mime_guess::mime;
use serde::Deserialize;
use std::path::PathBuf;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
const WRITE_PACK_SIZE: usize = 1 * 1024 * 1024;
const DEFAULT_PORT: u16 = 3300;
const DEFAULT_HOST: &str = "0.0.0.0";

static STATIC: Dir = include_dir!("../build/static");

#[derive(Parser)]
#[command(
    name = "homebox",
    version = VERSION,
    about = "A Toolbox for Home Local Networks Speed Test",
    long_about = "Homebox is a speed test tool for home local networks, providing download/upload testing and ping latency measurement."
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Start the speed test server
    Serve(ServeArgs),
    /// Show version information
    Version,
}

#[derive(Args)]
struct ServeArgs {
    /// Port to listen on
    #[arg(short, long, default_value_t = DEFAULT_PORT, help = "Port to listen on")]
    port: u16,

    /// Host address to bind to
    #[arg(short, long, default_value = DEFAULT_HOST, help = "Host address to bind to")]
    host: String,
}

#[get("/ping")]
async fn ping_get() -> impl Responder {
    HttpResponse::Ok()
        .content_type(ContentType::json())
        .body("{\"message\": \"pong\"}")
}


#[head("/ping")]
async fn ping_head() -> impl Responder {
    HttpResponse::NoContent().finish()
}


#[derive(Deserialize)]
struct DownloadQuery {
    count: Option<String>,
    size: Option<String>,
}

#[get("/download")]
async fn download(query: web::Query<DownloadQuery>) -> impl Responder {
    let mut count = query
        .count
        .clone()
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(8);
    
    let size = query
        .size
        .clone()
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(WRITE_PACK_SIZE);
    
    let vecs = vec![0; size];

    let stream = poll_fn(move |_| -> Poll<Option<Result<web::Bytes, Error>>> {
        if count > 0 {
            count -= 1;
            Poll::Ready(Some(Ok(web::Bytes::from(vecs.clone()))))
        } else {
            Poll::Ready(None)
        }
    });

    HttpResponse::Ok()
        .append_header((
            "Cache-Control",
            "no-store, no-cache, must-revalidate, max-age=0",
        ))
        .append_header(("Content-Disposition", "attachment; filename=random.dat"))
        .append_header(("Content-Transfer-Encoding", "binary"))
        .streaming(stream)
}

#[post("/upload")]
async fn upload(mut body: web::Payload) -> impl Responder {
    while let Some(chunk) = body.next().await {
        let _ = chunk;
    }
    HttpResponse::Ok().finish()
}

#[options("/upload")]
async fn upload_options() -> impl Responder {
    HttpResponse::Ok()
        .append_header(("Access-Control-Allow-Methods", "POST, OPTIONS"))
        .append_header(("Access-Control-Allow-Headers", "Content-Type"))
        .body("")
}

#[get("/static/{filename:.*}")]
async fn static_resource(req: HttpRequest) -> impl Responder {
    let path: PathBuf = req.match_info().query("filename").parse().unwrap();
    let mime = mime_guess::from_path(&path);
    
    match STATIC.get_file(path.to_str().unwrap()) {
        Some(file) => {
            let content_type = mime.first().unwrap_or(mime::TEXT_PLAIN);
            HttpResponse::Ok()
                .content_type(content_type)
                .body(file.contents())
        }
        None => HttpResponse::NotFound().body("File not found"),
    }
}


#[get("/")]
async fn index() -> impl Responder {
    match STATIC.get_file("index.html") {
        Some(file) => HttpResponse::Ok()
            .content_type(ContentType::html())
            .body(file.contents_utf8().unwrap_or("")),
        None => HttpResponse::NotFound().body("index.html not found"),
    }
}

#[get("/version")]
async fn version_info() -> impl Responder {
    HttpResponse::Ok()
        .content_type(ContentType::json())
        .json(serde_json::json!({
            "version": VERSION,
            "name": "homebox",
            "api_version": "v1"
        }))
}

async fn start_server(host: String, port: u16) -> std::io::Result<()> {
    let server = HttpServer::new(|| {
        App::new()
            .wrap(middleware::DefaultHeaders::new()
                .add(("Access-Control-Allow-Origin", "*"))
                .add(("Access-Control-Allow-Methods", "GET, POST, OPTIONS"))
            )
            .wrap(middleware::Logger::default())
            .service(download)
            .service(upload)
            .service(upload_options)
            .service(ping_get)
            .service(ping_head)
            .service(version_info)
            .service(static_resource)
            .service(index)
    })
    .bind((host.as_str(), port))?
    .run();

    println!("Homebox server v{} started", VERSION);
    println!("Listening on: http://{}:{}", host, port);
    println!("API endpoints:");
    println!("   - GET  /ping       - Health check (with JSON response)");
    println!("   - HEAD /ping       - Health check (headers only)");
    println!("   - GET  /download   - Download speed test");
    println!("   - POST /upload     - Upload speed test");
    println!("   - GET  /version    - Version info");
    println!("   - GET  /           - Web interface");
    println!("Press Ctrl+C to stop");

    server.await
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));
    
    let cli = Cli::parse();

    match cli.command {
        Some(Commands::Serve(args)) => {
            start_server(args.host, args.port).await
        }
        Some(Commands::Version) => {
            println!("Homebox v{}", VERSION);
            println!("Build with: {}", env!("CARGO_PKG_RUST_VERSION"));
            Ok(())
        }
        None => {
            println!("No command specified, starting server with default settings...");
            start_server(DEFAULT_HOST.to_string(), DEFAULT_PORT).await
        }
    }
}