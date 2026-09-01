terraform {
  backend "s3" {
    bucket       = "cahy-sepovsss"
    key          = "terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
  }
}