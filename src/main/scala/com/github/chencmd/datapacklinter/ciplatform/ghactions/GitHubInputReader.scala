package com.github.chencmd.datapacklinter.ciplatform.ghactions

import com.github.chencmd.datapacklinter.ciplatform.CIPlatformReadKeyedConfigInstr

import cats.data.{OptionT, EitherT}
import cats.effect.{Async, Resource}
import cats.implicits.*

import typings.actionsCore.mod as core
import typings.actionsCore.mod.InputOptions

object GitHubInputReader {
  import CIPlatformReadKeyedConfigInstr.ConfigValueType

  def createInstr[F[_]: Async](): Resource[[A] =>> EitherT[F, String, A], CIPlatformReadKeyedConfigInstr[F]] = {
    val program = Async[F].delay {
      new CIPlatformReadKeyedConfigInstr[F] {
        override protected def readKey[A](key: String, required: Boolean, default: => Option[A])(
          using valueType: ConfigValueType[A]
        ): EitherT[F, String, A] = {
          EitherT(Async[F].delay {
            try {
              Some(core.getInput(key, InputOptions().setRequired(required)))
                .filter(_.nonEmpty)
                .traverse(v => valueType.tryCast(key, v))
                .map(_.getOrElse(default.get))
            } catch e => Left(e.getMessage())
          })
        }
      }
    }

    Resource.eval(program).mapK(EitherT.liftK)
  }
}
